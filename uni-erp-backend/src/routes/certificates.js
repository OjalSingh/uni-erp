const express = require("express");
const Mark = require("../models/Mark");
const ResultPublish = require("../models/ResultPublish");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { escapeRegex } = require("../lib/util");
const { summarise, combine } = require("../lib/result");
const { loadPartOne } = require("../lib/partOne");
const { expectedMap, expectedFor } = require("../lib/subjects");
const Student = require("../models/Student");

const router = express.Router();
router.use(requireAuth, requirePermission("certificates:print"));

// Only schedules whose results have been published can have certificates printed
router.get("/schedules", async (_req, res) => {
  const rows = await ResultPublish.find({ published: true }).sort({ publishId: -1 }).populate("schedule", "examId examTerm year session formStart formEnd");
  res.json(rows.map((r) => r.schedule));
});

router.get("/", async (req, res) => {
  const { schedule, search = "" } = req.query;
  if (!schedule) return res.status(400).json({ message: "Choose an exam schedule" });
  if (!(await ResultPublish.exists({ schedule, published: true }))) {
    return res.status(400).json({ message: "Results for this schedule have not been published" });
  }
  const filter = { schedule };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const ids = await Student.find({ $or: [{ name: rx }, { enrollNo: rx }] }).select("_id");
    filter.$or = [{ rollNo: rx }, { student: { $in: ids.map((s) => s._id) } }];
  }
  const rows = await Mark.find(filter).sort({ rollNo: 1 }).limit(200)
    .populate("student", "enrollNo name fatherName gender image")
    .populate({ path: "course", select: "name parts durationYears courseType", populate: { path: "courseType", select: "name" } })
    .populate("schedule", "examId examTerm year session");
  const earlier = await loadPartOne(rows.filter((m) => m.part > 1).map((m) => m.student._id));
  const exp = await expectedMap(rows);
  res.json(rows.map((m) => {
    const result = summarise(m.subjectMarks, expectedFor(exp, m));
    return { ...m.toJSON(), result, final: m.part > 1 ? combine(result, earlier.get(String(m.student._id))) : null, partOne: m.part > 1 ? earlier.get(String(m.student._id)) || null : null };
  }));
});

module.exports = router;
