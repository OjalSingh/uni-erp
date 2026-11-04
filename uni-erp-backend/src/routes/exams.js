const express = require("express");
const ExamSchedule = require("../models/ExamSchedule");
const ExamForm = require("../models/ExamForm");
const Mark = require("../models/Mark");
const Student = require("../models/Student");
const { requireAuth, requirePermission, centerScope } = require("../middleware/auth");
const { guarded, paging, escapeRegex, nextNumber } = require("../lib/util");

const router = express.Router();
router.use(requireAuth);

// ----- Schedules -----
router.get("/schedules", requirePermission("exams:view", "marks:view", "results:view", "admitcards:print"), async (_req, res) => res.json(await ExamSchedule.find().sort({ examId: -1 })));

router.post("/schedules", requirePermission("exams:schedule"), (req, res) => {
  const { examTerm, year, formStart, formEnd, session } = req.body || {};
  return guarded(res, async () => {
    const examId = await nextNumber(ExamSchedule, "examId");
    res.status(201).json(await ExamSchedule.create({ examId, examTerm, year, formStart, formEnd, session }));
  });
});

router.put("/schedules/:id", requirePermission("exams:schedule"), (req, res) => {
  const { examTerm, year, formStart, formEnd, session } = req.body || {};
  return guarded(res, async () => {
    const s = await ExamSchedule.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Schedule not found" });
    Object.assign(s, { examTerm, year, formStart, formEnd, session });
    await s.save();
    res.json(s);
  });
});

// ----- Admit cards: accepted forms with everything needed to print -----
router.get("/admit-cards", requirePermission("admitcards:print"), async (req, res) => {
  const { schedule, search = "" } = req.query;
  if (!schedule) return res.status(400).json({ message: "Choose an exam schedule" });
  const filter = { schedule, status: "Accepted", ...centerScope(req) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const ids = await Student.find({ ...centerScope(req), $or: [{ name: rx }, { enrollNo: rx }] }).select("_id");
    filter.$or = [{ rollNo: rx }, { student: { $in: ids.map((s) => s._id) } }];
  }
  const items = await ExamForm.find(filter)
    .sort({ rollNo: 1 })
    .limit(200)
    .populate("student", "enrollNo name fatherName dob gender image")
    .populate("center", "code name")
    .populate("course", "name code")
    .populate("schedule", "examId examTerm year session");
  res.json(items);
});

// ----- Exam forms -----
// Roll no. = 2-digit course code + 2-digit exam year + 4-digit running number within that course and year
async function nextRollNo(course, schedule) {
  const prefix = String(course.code || "0").padStart(2, "0") + String(schedule.year).slice(-2);
  const last = await ExamForm.findOne({ rollNo: new RegExp(`^${prefix}\\d{4}$`) }).sort({ rollNo: -1 }).select("rollNo");
  const seq = last ? parseInt(last.rollNo.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(seq).padStart(4, "0");
}

router.get("/forms", requirePermission("exams:view"), async (req, res) => {
  const { schedule, search = "" } = req.query;
  if (!schedule) return res.status(400).json({ message: "Choose an exam schedule" });
  const filter = { schedule, ...centerScope(req) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const ids = await Student.find({ ...centerScope(req), $or: [{ name: rx }, { enrollNo: rx }] }).select("_id");
    filter.$or = [{ rollNo: rx }, { student: { $in: ids.map((s) => s._id) } }];
  }
  const { page, limit, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    ExamForm.find(filter).sort({ rollNo: 1 }).skip(skip).limit(limit)
      .populate("student", "enrollNo name").populate("center", "code").populate("course", "name code"),
    ExamForm.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.post("/forms", requirePermission("exams:create"), (req, res) => {
  const { schedule: scheduleId, enrollNo, part = 1, medium = "Hindi" } = req.body || {};
  return guarded(res, async () => {
    const schedule = await ExamSchedule.findById(scheduleId);
    if (!schedule) return res.status(400).json({ message: "Choose an exam schedule" });

    // Centers can only fill forms inside the window; head office may add late forms
    const today = new Date();
    const closes = new Date(schedule.formEnd);
    closes.setHours(23, 59, 59, 999);
    if (req.user.role === "center" && (today < schedule.formStart || today > closes)) {
      return res.status(400).json({ message: "Exam form filling is closed for this schedule" });
    }

    const student = await Student.findOne({ enrollNo: String(enrollNo || "").trim(), status: "Active", ...centerScope(req) }).populate("course");
    if (!student) return res.status(404).json({ message: "No active student with that enrollment number" });
    const partNo = Number(part);
    if (!Number.isInteger(partNo) || partNo < 1 || partNo > (student.course.parts || 1)) {
      return res.status(400).json({ message: `Part must be between 1 and ${student.course.parts || 1} for this course` });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rollNo = await nextRollNo(student.course, schedule);
        const form = await ExamForm.create({ schedule: schedule._id, student: student._id, center: student.center, course: student.course._id, part: partNo, medium, rollNo });
        return res.status(201).json(form);
      } catch (e) {
        // roll-number collision from a concurrent insert: retry; the (schedule, student, part) duplicate is reported by guarded()
        if (!(e.code === 11000 && e.keyPattern?.rollNo) || attempt === 2) throw e;
      }
    }
  }, "This student already has an exam form for that part in this schedule");
});

router.put("/forms/:id", requirePermission("exams:create"), (req, res) =>
  guarded(res, async () => {
    const form = await ExamForm.findOne({ _id: req.params.id, ...centerScope(req) });
    if (!form) return res.status(404).json({ message: "Exam form not found" });
    if (req.user.role === "center" && form.status !== "Pending") return res.status(400).json({ message: "Only pending forms can be changed" });
    if (req.body?.medium) form.medium = req.body.medium;
    await form.save();
    res.json(form);
  })
);

// Head office accepts or denies forms, singly or in bulk
router.post("/forms/status", requirePermission("exams:review"), async (req, res) => {
  const { ids, status } = req.body || {};
  if (!["Accepted", "Denied", "Pending"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "Select at least one form" });
  const r = await ExamForm.updateMany({ _id: { $in: ids } }, { status });
  res.json({ updated: r.modifiedCount });
});

router.delete("/forms/:id", requirePermission("exams:create"), async (req, res) => {
  const form = await ExamForm.findOne({ _id: req.params.id, ...centerScope(req) });
  if (!form) return res.status(404).json({ message: "Exam form not found" });
  if (req.user.role === "center" && form.status !== "Pending") return res.status(400).json({ message: "Only pending forms can be removed" });
  if (await Mark.exists({ examForm: form._id })) return res.status(409).json({ message: "Marks exist for this form. Delete the marks first." });
  await form.deleteOne();
  res.json({ message: "Exam form removed" });
});

module.exports = router;
