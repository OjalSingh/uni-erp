const express = require("express");
const Mark = require("../models/Mark");
const ResultPublish = require("../models/ResultPublish");
const { requireAuth, requireRole } = require("../middleware/auth");
const { escapeRegex } = require("../lib/util");
const Student = require("../models/Student");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

// Only schedules whose results have been published can have certificates printed
router.get("/schedules", async (_req, res) => {
  const rows = await ResultPublish.find({ published: true }).sort({ publishId: -1 }).populate("schedule", "examId examTerm year formStart formEnd");
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
  res.json(
    await Mark.find(filter).sort({ rollNo: 1 }).limit(200)
      .populate("student", "enrollNo name fatherName image")
      .populate("course", "name code")
      .populate("schedule", "examId examTerm year")
  );
});

module.exports = router;
