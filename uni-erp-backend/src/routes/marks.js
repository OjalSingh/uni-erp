const express = require("express");
const Mark = require("../models/Mark");
const ExamForm = require("../models/ExamForm");
const Student = require("../models/Student");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded, paging, escapeRegex } = require("../lib/util");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

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
  const [items, total] = await Promise.all([
    Mark.find(filter).sort({ rollNo: 1 }).skip(skip).limit(limit).populate("student", "enrollNo name").populate("course", "name code"),
    Mark.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// Marks can only be added for a student whose exam form for that part was accepted
router.post("/", (req, res) => {
  const { schedule, enrollNo, part = 1, theoryMarks = 0, practicalMarks = 0 } = req.body || {};
  return guarded(res, async () => {
    const student = await Student.findOne({ enrollNo: String(enrollNo || "").trim() });
    if (!student) return res.status(404).json({ message: "No student with that enrollment number" });
    const form = await ExamForm.findOne({ schedule, student: student._id, part: Number(part) });
    if (!form) return res.status(400).json({ message: "This student has no exam form for that part in this schedule" });
    if (form.status !== "Accepted") return res.status(400).json({ message: "The exam form has not been accepted yet" });

    const mark = await Mark.create({
      schedule, student: student._id, examForm: form._id, rollNo: form.rollNo, course: form.course, part: form.part,
      theoryMarks: Number(theoryMarks), practicalMarks: Number(practicalMarks),
    });
    res.status(201).json(mark);
  }, "Marks for this student, part and schedule are already entered. Modify them instead.");
});

router.put("/:id", (req, res) => {
  const { theoryMarks, practicalMarks } = req.body || {};
  return guarded(res, async () => {
    const mark = await Mark.findById(req.params.id);
    if (!mark) return res.status(404).json({ message: "Marks not found" });
    mark.theoryMarks = Number(theoryMarks);
    mark.practicalMarks = Number(practicalMarks);
    await mark.save();
    res.json(mark);
  });
});

router.delete("/:id", async (req, res) => {
  const mark = await Mark.findByIdAndDelete(req.params.id);
  if (!mark) return res.status(404).json({ message: "Marks not found" });
  res.json({ message: "Marks deleted" });
});

module.exports = router;
