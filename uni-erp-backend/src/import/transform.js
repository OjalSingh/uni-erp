// Turns parsed legacy rows into app documents. Pure: no database, no file output.
// References between documents are written as legacy ids; the writer swaps them for real ObjectIds.

const clean = (v) => (v == null ? undefined : String(v).replace(/\s+/g, " ").trim() || undefined);
const digits = (v) => (v == null ? undefined : String(v).replace(/\D/g, "") || undefined);
const num = (v) => (v == null || v === "" ? undefined : Number(v));

// MySQL dates arrive as "2021-06-26" or "2021-06-26 00:00:00" (the dump is UTC); student dates of birth are "dd/mm/yyyy"
function toDate(v) {
  if (!v || typeof v !== "string" || v.startsWith("0000")) return undefined;
  const d = new Date(v.replace(" ", "T") + (v.length === 10 ? "T00:00:00Z" : "Z"));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function dobToDate(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || "");
  if (!m) return undefined;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] ? d : undefined; // rejects 31/02 and the like
}

// The old state list uses other spellings than the app's. Map them onto one canonical name so dropdowns have no duplicates.
const CANON_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
const STATE_ALIASES = { orissa: "Odisha", "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu", "daman and diu": "Dadra and Nagar Haveli and Daman and Diu", pondicherry: "Puducherry" };
const stateKey = (n) => String(n).toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
const CANON_BY_KEY = new Map([...CANON_STATES.map((n) => [stateKey(n), n]), ...Object.entries(STATE_ALIASES)]);
const canonState = (n) => (n == null ? undefined : CANON_BY_KEY.get(stateKey(n)) || String(n).replace(/\s+/g, " ").trim());

const TERM = { MJ: "May-June", ND: "Nov-Dec" };
const GENDER = { F: "Female", M: "Male", T: "Transgender" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[6-9]\d{9}$/;

function transform(data) {
  const report = { notes: [], counts: {}, skipped: {} };
  const attention = []; // { sid, enrollNo, issues } for records that would not pass today's entry rules
  const duplicateEnrollments = [];
  const skip = (k, n = 1) => (report.skipped[k] = (report.skipped[k] || 0) + n);
  const by = (rows, key) => new Map(rows.map((r) => [r[key], r]));
  const group = (rows, fn) => { const m = new Map(); for (const r of rows) { const k = fn(r); (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };

  // A state that no student, center or city uses and that is not a real state (a test entry) is left out
  const usedStateIds = new Set([...data.student.map((r) => r.stateid), ...data.franchise.map((r) => r.state_id), ...data.city.map((r) => r.stateid)]);
  const realStates = data.state.filter((r) => CANON_BY_KEY.has(stateKey(r.state)) || usedStateIds.has(r.stateid));
  const droppedStates = data.state.length - realStates.length;
  if (droppedStates) report.notes.push(`${droppedStates} state entry that is not a real state (a test entry, unused) was left out.`);
  const stateName = new Map(realStates.map((r) => [r.stateid, canonState(r.state)]));
  const cityName = new Map(data.city.map((r) => [r.cityid, clean(r.city)]));
  const education = by(data.education, "education_id");
  const property = by(data.property, "property_id");
  const item = by(data.items, "item_id");

  const out = [];
  const add = (key, docs, opts = {}) => { out.push({ key, docs, ...opts }); report.counts[key] = docs.length; };

  // ----- States, cities, financial years -----
  add("state", realStates.map((r) => ({ legacyId: r.stateid, name: canonState(r.state), active: true })), { upsert: ["name"] });
  add("city", data.city.filter((r) => stateName.get(r.stateid) && clean(r.city)).map((r) => ({ legacyId: r.cityid, state: r.stateid, name: clean(r.city), active: true })), { upsert: ["state", "name"], refs: { state: "state" } });

  const sessions = new Set([...data.student.map((r) => r.stusession), ...data.examform.map((r) => r.stusession), ...data.financialyear.map((r) => r.fnyear)].filter((s) => /^\d{4}-\d{2}$/.test(s || "")));
  add("financialYear", [...sessions].sort().map((label) => ({ label })), { upsert: ["label"], noLegacyId: true });

  // ----- Course types, courses, subjects -----
  add("courseType", data.ctype.map((r) => ({ legacyId: r.ctype_id, name: clean(r.ctype_name) })), { upsert: ["name"] });

  const partsByCourse = new Map();
  for (const s of data.subjectdetail) partsByCourse.set(s.course_id, Math.max(partsByCourse.get(s.course_id) || 1, s.part || 1));
  add("course", data.courses.map((r) => ({
    legacyId: r.course_id, courseType: r.ctype_id, name: clean(r.course_name), code: String(r.course_id),
    parts: partsByCourse.get(r.course_id) || 1, durationYears: r.duration ? r.duration / 12 : undefined,
  })), { upsert: ["courseType", "name"], refs: { courseType: "courseType" } });

  const subjectKeys = new Set();
  const subjects = [];
  for (const r of data.subjectdetail) {
    const type = r.subject_type === "P" ? "Practical" : "Theory";
    const part = Math.max(r.part || 1, 1);
    let name = clean(r.subject_name);
    if (!name) { skip("subjects without a name"); continue; }
    if (subjectKeys.has([r.course_id, part, name, type].join("|"))) name = `${name} (paper ${clean(r.paper)})`;
    subjectKeys.add([r.course_id, part, name, type].join("|"));
    subjects.push({ legacyId: r.subject_id, course: r.course_id, part, name, code: clean(r.paper), type, maxMarks: num(r.marks) });
  }
  add("subject", subjects, { upsert: ["course", "part", "name", "type"], refs: { course: "course" } });
  const subjectById = by(data.subjectdetail, "subject_id");

  // ----- Centers (franchises) with their owner's details -----
  const ownerByFranchise = new Map();
  for (const e of data.employee) if (e.franchise_flag === "F" && !ownerByFranchise.has(e.franchise_id)) ownerByFranchise.set(e.franchise_id, e);
  add("center", data.franchise.map((r) => {
    const o = ownerByFranchise.get(r.franchise_id);
    const email = clean(r.email_id)?.toLowerCase();
    const pin = r.pincode ? String(r.pincode) : undefined;
    return {
      legacyId: r.franchise_id, code: String(r.franchise_code), name: clean(r.franchise_name),
      address: [clean(r.address1), clean(r.address2)].filter(Boolean).join(", ") || undefined,
      state: stateName.get(r.state_id), city: cityName.get(r.city_id), pinCode: pin && /^\d{6}$/.test(pin) ? pin : undefined,
      email: email && EMAIL.test(email) ? email : undefined, mobile: digits(r.mobile_no) || digits(r.phone_no),
      qualification: clean(education.get(r.qualification_id)?.education_name), instituteProperty: clean(property.get(r.property_id)?.property_name),
      currentOccupation: clean(r.occupation),
      ownerFirstName: clean(o?.fname), ownerLastName: clean(o?.lname), ownerMobile: digits(o?.mobileno),
      ownerEmail: EMAIL.test(clean(o?.emailid)?.toLowerCase() || "") ? clean(o.emailid).toLowerCase() : undefined,
      status: r.status === "A" && r.deleted !== "Y" ? "Active" : "Inactive", createdAt: toDate(r.create_date),
    };
  }), { upsert: ["code"], refs: {} });

  // ----- Users: login + employee. Passwords are never read from the old data. -----
  const empById = by(data.employee, "emp_id");
  const seenUser = new Set();
  const users = [];
  for (const l of data.login) {
    const e = empById.get(l.emp_id);
    const username = clean(l.username)?.toLowerCase();
    if (!e || !username) { skip("logins without an employee record"); continue; }
    if (seenUser.has(username)) { skip("duplicate usernames"); continue; }
    seenUser.add(username);
    const admin = e.franchise_flag === "S";
    users.push({
      legacyId: l.emp_id, username, name: [clean(e.fname), clean(e.lname)].filter(Boolean).join(" ") || username,
      email: EMAIL.test(clean(e.emailid)?.toLowerCase() || "") ? clean(e.emailid).toLowerCase() : undefined, mobile: digits(e.mobileno),
      role: admin ? "admin" : "center", roleKey: admin ? "admin" : "center", center: l.franchise_id,
      active: l.status === "A" && l.deleted !== "Y" && e.deleted !== "Y", createdAt: toDate(l.create_date),
    });
  }
  add("user", users, { upsert: ["username"], refs: { center: "center" }, isUser: true });

  // ----- Students (+ qualifications) -----
  const quals = group(data.qualification, (q) => q.sid);
  const acBySid = new Set(data.admitcard.map((a) => a.sid));
  void acBySid;
  const students = [];
  const keepers = new Map(); // enrollment_no -> sid that keeps the number
  // Numbers are "<2-digit session year><5-digit running number>". A student whose number is shared gets the next free one in their session's series.
  const usedNumbers = new Set(data.student.map((r) => String(r.enrollment_no)));
  const lastInSeries = new Map();
  for (const r of data.student) {
    const m = /^(\d{2})(\d{5})$/.exec(String(r.enrollment_no));
    if (m) lastInSeries.set(m[1], Math.max(lastInSeries.get(m[1]) || 0, Number(m[2])));
  }
  const nextFreeNumber = (session) => {
    const prefix = String(session || "").slice(2, 4);
    if (!/^\d{2}$/.test(prefix)) throw new Error(`Cannot number a student with session "${session}"`);
    let seq = (lastInSeries.get(prefix) || 0) + 1;
    while (usedNumbers.has(prefix + String(seq).padStart(5, "0"))) seq++;
    if (seq > 99999) throw new Error(`Enrollment number series ${prefix} is full`);
    lastInSeries.set(prefix, seq);
    const n = prefix + String(seq).padStart(5, "0");
    usedNumbers.add(n);
    return n;
  };
  const referenced = new Set([...data.admitcard.map((a) => a.sid), ...data.marks.map((m) => m.student_id)]);
  const sortedStudents = [...data.student].sort((a, b) => (referenced.has(b.sid) - referenced.has(a.sid)) || a.sid - b.sid);
  for (const r of sortedStudents) {
    const issues = [];
    let enrollNo = String(r.enrollment_no);
    let legacyEnrollNo;
    if (keepers.has(r.enrollment_no)) {
      legacyEnrollNo = enrollNo;
      enrollNo = nextFreeNumber(r.stusession);
      duplicateEnrollments.push({ enrollment_no: r.enrollment_no, kept_sid: keepers.get(r.enrollment_no), renamed_sid: r.sid, new_enrollment_no: enrollNo });
      issues.push("enrollment number was shared with another student, so a new one was assigned");
    } else keepers.set(r.enrollment_no, r.sid);

    const mobile = digits(r.mobileno);
    if (!mobile) issues.push("no mobile number"); else if (!MOBILE.test(mobile)) issues.push("mobile number is not 10 digits");
    const email = clean(r.email_id)?.toLowerCase();
    const validEmail = email && EMAIL.test(email) ? email : undefined;
    if (email && !validEmail) issues.push("email address is not valid");
    const dob = dobToDate(r.dob);
    if (!dob) issues.push("no date of birth");
    else { const cut = new Date(); cut.setFullYear(cut.getFullYear() - 18); if (dob > cut) issues.push("under 18"); }
    if (!r.gender) issues.push("no gender");
    const nat = clean(r.nationality);
    const pin = r.pincode ? String(r.pincode) : undefined;

    const q = (quals.get(r.sid) || []).sort((a, b) => a.sno - b.sno).slice(0, 6)
      .map((x) => ({ examination: clean(x.exam_name), board: clean(x.board_university), year: x.year ? String(x.year) : undefined, division: clean(x.division) }));
    if ((quals.get(r.sid) || []).length > 6) skip("qualification rows beyond the sixth");

    if (issues.length) attention.push({ sid: r.sid, enrollment_no: enrollNo, issues: issues.join("; ") });
    students.push({
      legacyId: r.sid, enrollNo, legacyEnrollNo, center: r.franchise_id, session: r.stusession, examTerm: TERM[r.exam_term],
      name: [clean(r.fname), clean(r.lname)].filter(Boolean).join(" "), fatherName: clean(r.father_name), mobile, email: validEmail,
      courseType: r.ctype_id, course: r.course_id, gender: GENDER[r.gender], dob, nationality: nat && /^indian$/i.test(nat) ? "Indian" : nat && nat[0].toUpperCase() + nat.slice(1).toLowerCase(),
      address: clean(r.address), state: stateName.get(r.stateid), city: cityName.get(r.cityid), pinCode: pin && /^\d{6}$/.test(pin) ? pin : undefined,
      legacyImage: r.img_name && !/^0\./.test(r.img_name) ? r.img_name : undefined, qualifications: q,
      status: r.status === "A" ? "Active" : "Inactive", createdAt: toDate(r.create_date),
    });
  }
  students.sort((a, b) => a.legacyId - b.legacyId);
  add("student", students, { refs: { center: "center", courseType: "courseType", course: "course" } });
  const studentBySid = by(data.student, "sid");

  // ----- Exam schedules -----
  const yearByExam = new Map();
  for (const [exam, rows] of group(data.admitcard, (a) => a.exam_id)) {
    const m = new Map(); for (const a of rows) m.set(a.exam_year, (m.get(a.exam_year) || 0) + 1);
    yearByExam.set(exam, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  add("examSchedule", data.examform.map((r) => ({
    legacyId: r.exam_id, examId: r.exam_id, examTerm: TERM[r.exam_term], session: clean(r.stusession),
    year: yearByExam.get(r.exam_id) || toDate(r.formfill_startdate)?.getUTCFullYear(), formStart: toDate(r.formfill_startdate), formEnd: toDate(r.formfill_enddate),
  })));

  // ----- Exam forms (admit card table) -----
  const STATUS = { A: "Accepted", D: "Denied", R: "Pending" };
  const MEDIUM = { H: "Hindi", E: "English" };
  const formByKey = new Map();
  for (const a of [...data.admitcard].sort((x, y) => x.acid - y.acid)) {
    const st = studentBySid.get(a.sid);
    if (!st) { skip("exam forms for unknown students"); continue; }
    const part = Math.max(a.part || 1, 1);
    const key = [a.sid, a.exam_id, part].join("|");
    if (formByKey.has(key)) skip("repeated exam forms (kept the latest)");
    formByKey.set(key, {
      legacyId: a.acid, schedule: a.exam_id, student: a.sid, center: a.franchise_id || st.franchise_id, course: st.course_id, part,
      medium: MEDIUM[a.exam_medium] || "Other", rollNo: String(a.rollno), status: STATUS[a.formfill_status] || "Pending", filledAt: toDate(a.formfill_date),
    });
  }
  const forms = [...formByKey.values()];
  add("examForm", forms, { refs: { schedule: "examSchedule", student: "student", center: "center", course: "course" } });
  const formsBySidExam = group(forms, (f) => `${f.student}|${f.schedule}`);

  // ----- Marks: one document per student, exam and part, keeping the subject-by-subject marks -----
  const markGroups = group(data.marks, (m) => [m.student_id, m.exam_id, Math.max(m.part || 1, 1)].join("|"));
  const markDocs = [];
  let overMax = 0, orphan = 0;
  for (const [key, rows] of markGroups) {
    const [sid, exam, part] = key.split("|").map(Number);
    const bySubject = new Map();
    for (const m of rows) bySubject.set(m.subject_id, m); // repeated subject rows: the last one wins
    if (bySubject.size < rows.length) skip("repeated subject marks (kept the latest)", rows.length - bySubject.size);
    let theory = 0, practical = 0;
    const subjectMarks = [];
    for (const m of bySubject.values()) {
      const sd = subjectById.get(Number(m.subject_id));
      const type = m.subject_type === "P" ? "Practical" : "Theory";
      if (type === "Practical") practical += m.getmarks; else theory += m.getmarks;
      if (sd && m.getmarks > sd.marks) overMax++;
      subjectMarks.push({ subject: clean(sd?.subject_name) || `Subject ${m.subject_id}`, code: clean(sd?.paper), type, maxMarks: sd ? sd.marks : undefined, marks: m.getmarks });
    }
    const exact = formByKey.get(`${sid}|${exam}|${part}`);
    const anyForm = exact || (formsBySidExam.get(`${sid}|${exam}`) || [])[0];
    if (!anyForm) orphan++;
    markDocs.push({
      legacyId: [...bySubject.values()][0].marks_id, schedule: exam, student: sid, examForm: exact ? exact.legacyId : undefined, rollNo: anyForm?.rollNo,
      course: [...bySubject.values()][0].course_id, part, theoryMarks: theory, practicalMarks: practical, subjectMarks,
      createdAt: toDate([...bySubject.values()][0].create_date),
    });
  }
  add("mark", markDocs, { refs: { schedule: "examSchedule", student: "student", examForm: "examForm", course: "course" } });
  report.notes.push(`${overMax} subject marks are higher than the subject's maximum (kept as entered).`);
  report.notes.push(`${orphan} mark sets have no exam form on record (imported without a roll number).`);

  // ----- Part 1 summaries -----
  const p1 = new Map();
  for (const r of [...data.partonemarks].sort((a, b) => a.part1_marks_id - b.part1_marks_id)) {
    if (!(r.total_marks > 0 || r.get_marks > 0)) continue;
    p1.set(`${r.sid}|${r.exam_id}`, { legacyId: r.part1_marks_id, student: r.sid, schedule: r.exam_id, totalMarks: r.total_marks, obtainedMarks: r.get_marks, createdAt: toDate(r.create_date) });
  }
  add("partOneMark", [...p1.values()].filter((d) => studentBySid.has(d.student)), { refs: { student: "student", schedule: "examSchedule" } });
  report.notes.push(`${data.partonemarks.length - p1.size} part-one rows were empty or repeated and were left out.`);

  // ----- Published results -----
  add("resultPublish", data.publish_result.map((r) => ({
    legacyId: r.publish_id, publishId: r.publish_id, schedule: r.exam_id, comments: clean(r.comments), publishDate: toDate(r.publish_date), endDate: toDate(r.end_date), published: r.status === "A",
  })), { refs: { schedule: "examSchedule" } });

  // ----- Suppliers, items, stock -----
  add("supplier", data.supplier.map((r) => ({
    legacyId: r.supplier_id, name: clean(r.supplier_name), businessName: clean(r.business_name), mobile: digits(r.mobile_no), email: clean(r.email_id)?.toLowerCase(),
    pan: clean(r.pan_no)?.toUpperCase(), gst: clean(r.gstin_no)?.toUpperCase(), address: clean(r.address), createdAt: toDate(r.create_date),
  })));
  add("item", data.items.map((r) => ({ legacyId: r.item_id, code: clean(r.item_code), name: clean(r.Item_name) })), { upsert: ["code"] });
  add("stockEntry", data.stock.map((r) => ({
    legacyId: r.stock_id, supplier: r.supplier_id, item: r.item_id, purchasePrice: r.purchase_price, sellPrice: r.sell_price, discountPercent: r.discount || 0,
    quantity: r.item_qty, receivedAt: toDate(r.receive_date),
  })), { refs: { supplier: "supplier", item: "item" } });

  // ----- Invoices and payments (cancelled invoices are history, not receivables, so they stay out) -----
  const PAYMODE = { CASH: "Cash", CHEQUE: "Cheque", UPI: "UPI", NEFT: "Bank transfer", RTGS: "Bank transfer", IMPS: "Bank transfer" };
  const paymentsByInvoice = group(data.payment, (p) => p.invoice_id);
  const invoices = [];
  for (const r of data.invoice) {
    if (r.status === "C") { skip("cancelled invoices (and their payments)"); continue; }
    const ids = String(r.item_id ?? "").split(","), qty = String(r.qty ?? "").split(","), price = String(r.unit_price ?? "").split(",");
    const lines = ids.map((id, i) => ({ description: clean(item.get(Number(id))?.Item_name) || `Item ${id}`, item: Number(id), quantity: Number(qty[i]), price: Number(price[i]), total: Number(qty[i]) * Number(price[i]) }));
    const subTotal = lines.reduce((s, l) => s + l.total, 0);
    const gstAmount = r.gst_amt || 0;
    invoices.push({
      legacyId: r.invoice_id, invoiceNo: r.invoice_id, center: r.franchise_id, date: toDate(r.invoice_date), lines, subTotal, gstAmount,
      gstPercent: subTotal ? Math.round((gstAmount / subTotal) * 10000) / 100 : 0, discount: r.discount || 0, grandTotal: r.total_amt,
      payments: (paymentsByInvoice.get(r.invoice_id) || []).map((p) => ({ amount: p.pay_amt, mode: PAYMODE[String(p.pay_mode).toUpperCase()] || "Other", paidAt: toDate(p.pay_date), reference: clean(p.receive_no) })),
    });
  }
  add("invoice", invoices, { refs: { center: "center" }, invoiceLines: true });

  // ----- What was left behind on purpose -----
  report.notes.push("Not imported: student and staff passwords (stored as plain text in the old data), per-user menu privileges, and the old menu tables. Roles and menus come from the new settings screens.");
  report.notes.push("Not imported: student photos and signatures as files; the file names are kept on each student for copying later.");
  return { collections: out, report, attention, duplicateEnrollments };
}

module.exports = { transform };
