const express = require("express");
const Mark = require("../models/Mark");
const ExamForm = require("../models/ExamForm");
const Student = require("../models/Student");
const { Subject } = require("../models/Course");
const { requireAuth, requirePermission, byMethod } = require("../middleware/auth");
const { guarded, paging, escapeRegex } = require("../lib/util");
const { summarise, paperOrder } = require("../lib/result");
const { loadPartOne } = require("../lib/partOne");
const { expectedMap, expectedFor } = require("../lib/subjects");

const router = express.Router();
router.use(requireAuth, byMethod("marks:view", "marks:edit"));

router.get("/", async (req, res) => {
  const { schedule, search = "" } = req.query;
  if (!schedule) return res.status(400).json({ message: "Choose an exam schedule" });
  const filter = { schedule };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const ids = await Student.find({ $or: [{ name: rx }, { enrollNo: rx }] }).select("_id");
    filter.$or = [{ rollNo: rx }, { student: { $in: ids.map((s) => s._id) } }];
  }
  const { page, limit, skip } = paging(req.query);
  const [rows, total] = await Promise.all([
    Mark.find(filter).sort({ rollNo: 1 }).skip(skip).limit(limit).populate("student", "enrollNo name").populate("course", "name code"),
    Mark.countDocuments(filter),
  ]);
  const exp = await expectedMap(rows);
  res.json({ items: rows.map((m) => ({ ...m.toJSON(), result: summarise(m.subjectMarks, expectedFor(exp, m)) })), total, page, pages: Math.ceil(total / limit) });
});

// ---- Subject-wise entry: look up a roll number, get the course's subjects for that part, save the marks for all of them ----
async function findForm(schedule, rollNo) {
  const form = await ExamForm.findOne({ schedule, rollNo: String(rollNo || "").trim() })
    .populate("student", "enrollNo name fatherName session")
    .populate("center", "code")
    .populate("course", "name parts");
  if (!form) return { error: [404, "No exam form with that roll number in this schedule"] };
  if (form.status !== "Accepted") return { error: [400, "The exam form for this roll number has not been accepted yet"] };
  const subjects = (await Subject.find({ course: form.course._id, part: form.part }))
    .sort((a, b) => (a.type === b.type ? paperOrder(a.code, b.code) : a.type === "Theory" ? -1 : 1));
  return { form, subjects };
}

router.get("/entry", requirePermission("marks:edit"), async (req, res) => {
  const { schedule, rollNo } = req.query;
  if (!schedule || !rollNo) return res.status(400).json({ message: "Choose an exam schedule and enter a roll number" });
  const { form, subjects, error } = await findForm(schedule, rollNo);
  if (error) return res.status(error[0]).json({ message: error[1] });

  const existing = await Mark.findOne({ schedule, student: form.student._id, part: form.part });
  const values = {};
  if (existing) {
    for (const s of subjects) {
      const hit = existing.subjectMarks.find((m) => m.type === s.type && m.code === s.code && m.subject === s.name) || existing.subjectMarks.find((m) => m.type === s.type && m.subject === s.name);
      if (hit) values[String(s._id)] = hit.marks;
    }
  }
  const partOne = form.part > 1 ? (await loadPartOne([form.student._id])).get(String(form.student._id)) || null : null;
  res.json({
    markId: existing ? existing.id : null,
    student: { name: form.student.name, fatherName: form.student.fatherName, enrollNo: form.student.enrollNo, session: form.student.session, centerCode: form.center?.code },
    rollNo: form.rollNo, part: form.part, course: { name: form.course.name, parts: form.course.parts },
    subjects: subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type, maxMarks: s.maxMarks })),
    values, partOne,
  });
});

router.post("/entry", requirePermission("marks:edit"), (req, res) =>
  guarded(res, async () => {
    const { schedule, rollNo, marks } = req.body || {};
    const { form, subjects, error } = await findForm(schedule, rollNo);
    if (error) return res.status(error[0]).json({ message: error[1] });
    if (!subjects.length) return res.status(400).json({ message: "No subjects are set up for this course and part. Add them under Miscellaneous > Subject Details." });
    const unset = subjects.filter((s) => !s.type || s.maxMarks == null);
    if (unset.length) return res.status(400).json({ message: `Set Theory or Practical and the maximum marks for "${unset[0].name}" in Subject Details first.` });

    const values = marks && typeof marks === "object" ? marks : {};
    const problems = [];
    const subjectMarks = [];
    for (const s of subjects) {
      const raw = values[String(s._id)];
      const n = Number(raw);
      if (raw === undefined || raw === null || raw === "" || !Number.isInteger(n)) problems.push(`${s.name}: enter whole-number marks`);
      else if (n < 0 || n > s.maxMarks) problems.push(`${s.name}: marks must be between 0 and ${s.maxMarks}`);
      else subjectMarks.push({ subject: s.name, code: s.code, type: s.type, maxMarks: s.maxMarks, marks: n });
    }
    if (problems.length) return res.status(400).json({ message: problems.slice(0, 3).join(". ") + (problems.length > 3 ? ` (and ${problems.length - 3} more)` : "") });

    const result = summarise(subjectMarks, subjects);
    const mark = await Mark.findOneAndUpdate(
      { schedule, student: form.student._id, part: form.part },
      { $set: { examForm: form._id, rollNo: form.rollNo, course: form.course._id, theoryMarks: result.theory.obtained, practicalMarks: result.practical.obtained, subjectMarks } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ message: "Marks saved", markId: mark.id, result });
  })
);

router.delete("/:id", async (req, res) => {
  const mark = await Mark.findByIdAndDelete(req.params.id);
  if (!mark) return res.status(404).json({ message: "Marks not found" });
  res.json({ message: "Marks deleted" });
});

module.exports = router;
