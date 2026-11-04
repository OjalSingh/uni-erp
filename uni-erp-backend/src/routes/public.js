// What students use, with no login: see when results are out and look one up by roll number.
const express = require("express");
const ResultPublish = require("../models/ResultPublish");
const ExamForm = require("../models/ExamForm");
const Mark = require("../models/Mark");
const captcha = require("../lib/captcha");
const { summarise, combine } = require("../lib/result");
const { loadPartOne } = require("../lib/partOne");
const { expectedMap, expectedFor } = require("../lib/subjects");

const router = express.Router();

// Per-address limits so roll numbers cannot be tried in bulk. Lookups have their own budget, separate from page loads, and it is generous
// enough for many students sharing one connection (mobile networks and internet cafes). The captcha is the main brake: every try needs a new picture.
const WINDOW_MS = 10 * 60 * 1000;
function limiter(max) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const hits = (buckets.get(req.ip) || []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= max) { buckets.set(req.ip, hits); return res.status(429).json({ message: "Too many attempts. Please try again in a few minutes." }); }
    hits.push(now);
    buckets.set(req.ip, hits);
    if (buckets.size > 5000) for (const [ip, h] of buckets) if (!h.some((t) => now - t < WINDOW_MS)) buckets.delete(ip);
    next();
  };
}
const pageLimit = limiter(200);
const lookupLimit = limiter(40);

const label = (s) => (s ? `${s.examTerm} ${s.year}${s.session ? ` (${s.session})` : ""}` : "");
const NOT_FOUND = { message: "No result found. Check the roll number and try again." }; // the same answer for every kind of miss

// A result is visible only while it is published and today falls inside its dates
async function openPublishes() {
  const today = new Date();
  const rows = await ResultPublish.find({ published: true }).sort({ publishId: -1 }).populate("schedule", "examId examTerm year session");
  const day = (d) => new Date(d).setHours(0, 0, 0, 0);
  return {
    open: rows.filter((r) => day(r.publishDate) <= today.getTime() && today.getTime() <= day(r.endDate) + 86399999),
    upcoming: rows.filter((r) => day(r.publishDate) > today.getTime()).sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate))[0] || null,
  };
}

const requireDob = () => process.env.RESULT_REQUIRE_DOB === "true";

router.get("/result-status", pageLimit, async (_req, res) => {
  const { open, upcoming } = await openPublishes();
  res.json({
    requireDob: requireDob(),
    open: open.map((r) => ({ publishId: r.publishId, label: label(r.schedule) })),
    upcoming: upcoming ? { publishDate: upcoming.publishDate, label: label(upcoming.schedule) } : null,
  });
});

router.get("/captcha", pageLimit, (_req, res) => res.json(captcha.create()));

const parseDob = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

router.post("/result", lookupLimit, async (req, res) => {
  const { rollNo, dob, captchaToken, captchaAnswer } = req.body || {};
  const roll = String(rollNo || "").trim();
  if (!/^\d{6,10}$/.test(roll)) return res.status(400).json({ message: "Enter your roll number (digits only)." });
  if (!captcha.verify(captchaToken, captchaAnswer)) return res.status(400).json({ message: "The number you typed does not match the picture. Try the new picture.", refreshCaptcha: true });

  const { open } = await openPublishes();
  if (!open.length) return res.status(404).json(NOT_FOUND);
  const wantedDob = requireDob() ? parseDob(dob) : null;
  if (requireDob() && !wantedDob) return res.status(400).json({ message: "Enter your date of birth as dd/mm/yyyy." });

  let forms = await ExamForm.find({ rollNo: roll, schedule: { $in: open.map((r) => r.schedule._id) }, status: "Accepted" })
    .populate({ path: "student", select: "name fatherName enrollNo dob" })
    .populate({ path: "course", select: "name parts courseType", populate: { path: "courseType", select: "name" } })
    .populate("schedule", "examTerm year session");
  if (requireDob()) forms = forms.filter((f) => f.student?.dob && f.student.dob.toISOString().slice(0, 10) === wantedDob);

  const statements = [];
  const earlier = await loadPartOne(forms.filter((f) => f.part > 1).map((f) => f.student._id));
  const exp = await expectedMap(forms.map((f) => ({ course: f.course._id, part: f.part })));
  for (const f of forms) {
    const mark = await Mark.findOne({ schedule: f.schedule._id, student: f.student._id, part: f.part });
    if (!mark || !mark.subjectMarks?.length) continue;
    const result = summarise(mark.subjectMarks, expectedFor(exp, { course: f.course._id, part: f.part }));
    const partOne = f.part > 1 ? earlier.get(String(f.student._id)) || null : null;
    statements.push({
      exam: label(f.schedule), rollNo: f.rollNo, part: f.part,
      student: { name: f.student.name, fatherName: f.student.fatherName, enrollNo: f.student.enrollNo },
      course: { name: f.course.name, type: f.course.courseType?.name, parts: f.course.parts },
      subjects: mark.subjectMarks.map((s) => ({ code: s.code, name: s.subject, type: s.type, maxMarks: s.maxMarks, marks: s.marks })),
      // An incomplete result (a paper has no marks yet) is shown without a division; the student is told to contact their center
      result: result.incomplete ? { incomplete: true, missingPapers: result.missingPapers } : result,
      partOne, final: partOne && !result.incomplete ? combine(result, partOne) : null,
    });
  }
  if (!statements.length) return res.status(404).json(NOT_FOUND);
  res.json({ statements });
});

// Courses for the public landing page (names and lengths only)
router.get("/courses", pageLimit, async (_req, res) => {
  const { Course } = require("../models/Course");
  const rows = await Course.find().populate("courseType", "name").select("name durationYears courseType").sort({ durationYears: -1, name: 1 }).lean();
  res.json(rows.map((c) => ({ name: c.name, durationYears: c.durationYears, type: c.courseType?.name })));
});

module.exports = router;
