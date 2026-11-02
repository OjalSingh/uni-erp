// Runs the import against an in-memory fake database that enforces the app's unique indexes.
// Usage: node src/import/selftest.js path/to/dump.sql      (nothing is written anywhere; output is counts only)
const { parseDump } = require("./dump");
const { transform } = require("./transform");
const { writeAll } = require("./write");

const NAMES = { state: "states", city: "cities", financialYear: "financialyears", courseType: "coursetypes", course: "courses", subject: "subjects", center: "centers", user: "users", student: "students", examSchedule: "examschedules", examForm: "examforms", mark: "marks", partOneMark: "partonemarks", resultPublish: "resultpublishes", supplier: "suppliers", item: "items", stockEntry: "stockentries", invoice: "invoices", role: "roles" };
// Mirrors the unique indexes declared in the models
const UNIQUE = {
  states: [["name"]], cities: [["state", "name"]], financialyears: [["label"]], coursetypes: [["name"]], subjects: [["course", "part", "name", "type"]],
  centers: [["code"]], users: [["username"]], students: [["enrollNo"]], examschedules: [["examId"]], examforms: [["schedule", "rollNo"], ["schedule", "student", "part"]],
  marks: [["schedule", "student", "part"]], partonemarks: [["student", "schedule"]], resultpublishes: [["publishId"]], items: [["code"]], roles: [["key"]],
};

let n = 0;
const newId = () => `id${++n}`;

class FakeCollection {
  constructor(name) { this.name = name; this.docs = []; }
  match(d, f) {
    return Object.entries(f).every(([k, v]) => (v && typeof v === "object" && "$exists" in v ? (d[k] !== undefined) === v.$exists : String(d[k]) === String(v)));
  }
  violates(doc) {
    for (const keys of UNIQUE[this.name] || []) {
      if (keys.some((k) => doc[k] === undefined)) continue;
      if (this.docs.some((d) => keys.every((k) => String(d[k]) === String(doc[k])))) return keys.join("+");
    }
    return null;
  }
  async insertMany(batch) {
    const writeErrors = []; let insertedCount = 0;
    batch.forEach((doc, index) => {
      const v = this.violates(doc);
      if (v) writeErrors.push({ index, errmsg: `duplicate key on ${v}` }); else { this.docs.push(doc); insertedCount++; }
    });
    if (writeErrors.length) { const e = new Error("bulk write error"); e.writeErrors = writeErrors; e.insertedCount = insertedCount; throw e; }
    return { insertedCount };
  }
  async updateOne(filter, update, { upsert }) {
    const found = this.docs.find((d) => this.match(d, filter));
    if (found) return Object.assign(found, update.$set), { upsertedCount: 0 };
    if (!upsert) return { upsertedCount: 0 };
    const doc = { _id: newId(), ...filter, ...update.$set, ...update.$setOnInsert };
    const v = this.violates(doc);
    if (v) throw new Error(`duplicate key on ${v}`);
    this.docs.push(doc);
    return { upsertedCount: 1 };
  }
  async findOne(filter) { return this.docs.find((d) => this.match(d, filter)) || null; }
  async countDocuments(filter = {}) { return this.docs.filter((d) => this.match(d, filter)).length; }
  async deleteMany(filter) { const before = this.docs.length; this.docs = this.docs.filter((d) => !this.match(d, filter)); return { deletedCount: before - this.docs.length }; }
}

const fakeDb = () => { const cols = {}; return { cols, col: (name) => (cols[name] ||= new FakeCollection(name)) }; };

(async () => {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node src/import/selftest.js path/to/dump.sql"); process.exit(1); }
  const result = transform(parseDump(file).data);
  const db = fakeDb();
  const hash = async (p) => "hash:" + p.length;
  let failures = 0;
  const check = (label, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

  // Start like a freshly seeded database: roles, the head office center, one dev account, a few states
  db.col("roles").docs.push({ _id: newId(), key: "admin" }, { _id: newId(), key: "center" });
  db.col("centers").docs.push({ _id: newId(), code: "1", name: "AIECCE" }, { _id: newId(), code: "1001", name: "Demo Study Center" });
  db.col("users").docs.push({ _id: newId(), username: "admin" });
  db.col("states").docs.push({ _id: newId(), name: "Delhi" }, { _id: newId(), name: "Odisha" });
  const distinctStates = new Set(result.collections.find((c) => c.key === "state").docs.map((d) => d.name)).size;

  const first = await writeAll(result, { db, names: NAMES, newId, hash, log: () => {} });
  const count = (k) => db.col(NAMES[k]).docs.length;
  check("no records rejected", Object.values(first.stats).every((s) => s.failed === 0), JSON.stringify(Object.entries(first.stats).filter(([, s]) => s.failed).map(([k, s]) => k + ":" + s.failed)));
  check("no unresolved references", first.warnings.length === 0, first.warnings.slice(0, 3).join(" | "));
  for (const k of ["student", "examSchedule", "examForm", "mark", "partOneMark", "resultPublish", "supplier", "stockEntry", "course", "subject", "city"]) check(`${k} count`, count(k) === result.report.counts[k], `${count(k)}/${result.report.counts[k]}`);
  check("centers merged by code (397 legacy + demo center 1001)", count("center") === 398, String(count("center")));
  check("old spellings merged onto the app's state names (no duplicates)", count("state") === distinctStates, `${count("state")} states, expected ${distinctStates}`);
  check("DELHI/Orissa did not create second entries", db.col("states").docs.filter((s) => /^(delhi|odisha|orissa)$/i.test(s.name)).length === 2);
  check("users: 402 created, dev account kept", count("user") === 403 && first.credentials.length === 402, `${count("user")} users, ${first.credentials.length} credentials`);
  check("every password is 12 characters and unique", new Set(first.credentials.map((c) => c.password)).size === 402 && first.credentials.every((c) => c.password.length === 12));

  // Every stored reference must point at a document that exists
  const REF = { student: { center: "centers", courseType: "coursetypes", course: "courses" }, examForm: { schedule: "examschedules", student: "students", center: "centers", course: "courses" }, mark: { schedule: "examschedules", student: "students", course: "courses" }, partOneMark: { student: "students", schedule: "examschedules" }, user: { center: "centers", roleRef: "roles" }, city: { state: "states" }, course: { courseType: "coursetypes" }, subject: { course: "courses" }, stockEntry: { supplier: "suppliers", item: "items" } };
  let dangling = 0;
  for (const [k, refs] of Object.entries(REF)) for (const d of db.col(NAMES[k]).docs) for (const [f, target] of Object.entries(refs)) if (d[f] !== undefined && !db.col(target).docs.some((x) => String(x._id) === String(d[f]))) dangling++;
  check("no dangling references", dangling === 0, String(dangling));
  const withForm = db.col("marks").docs.filter((m) => m.examForm !== undefined);
  check("marks with a form point at an existing form", withForm.every((m) => db.col("examforms").docs.some((f) => String(f._id) === String(m.examForm))));
  const changed = db.col("students").docs.filter((x) => x.legacyEnrollNo !== undefined);
  check("shared enrollment numbers were replaced by normal-format numbers", changed.length === 192 && changed.every((x) => /^\d{7}$/.test(x.enrollNo) && x.enrollNo !== x.legacyEnrollNo), `${changed.length} changed`);
  check("no enrollment number carries a suffix", db.col("students").docs.every((x) => /^\d+$/.test(x.enrollNo)));
  check("no undefined/null leaks into stored documents", db.col("students").docs.every((s) => Object.values(s).every((v) => v !== undefined && v !== null)));

  // Second run must refuse, then --replace must reproduce the same result without changing existing passwords
  let refused = false;
  try { await writeAll(result, { db, names: NAMES, newId, hash }); } catch { refused = true; }
  check("second run without --replace is refused", refused);
  const second = await writeAll(result, { db, names: NAMES, newId, hash, replace: true, log: () => {} });
  check("--replace: same counts again", count("student") === result.report.counts.student && count("examForm") === result.report.counts.examForm && count("mark") === result.report.counts.mark);
  check("--replace: config not duplicated", count("center") === 398 && count("state") === distinctStates && count("city") === result.report.counts.city && count("user") === 403);
  check("--replace: existing users keep their passwords (no new credentials)", second.credentials.length === 0);

  // Data entered in the app must block an import
  const db2 = fakeDb();
  db2.col("roles").docs.push({ _id: newId(), key: "admin" }, { _id: newId(), key: "center" });
  db2.col("students").docs.push({ _id: newId(), enrollNo: "1" });
  let blocked = false;
  try { await writeAll(result, { db: db2, names: NAMES, newId, hash }); } catch { blocked = true; }
  check("existing app-entered students block the import", blocked);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
