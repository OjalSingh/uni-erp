const express = require("express");
const { CourseType, Course } = require("../models/Course");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/course-types", async (_req, res) => res.json(await CourseType.find().sort({ name: 1 })));

router.post("/course-types", requireRole("admin"), async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "Name is required" });
  try {
    res.status(201).json(await CourseType.create({ name }));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Course type already exists" });
    throw e;
  }
});

// Optional ?courseType=<id> powers the dependent Course dropdown on the registration form
router.get("/courses", async (req, res) => {
  const filter = req.query.courseType ? { courseType: req.query.courseType } : {};
  res.json(await Course.find(filter).sort({ name: 1 }));
});

router.post("/courses", requireRole("admin"), async (req, res) => {
  const { courseType, name, durationYears } = req.body || {};
  if (!courseType || !String(name || "").trim()) return res.status(400).json({ message: "Course type and name are required" });
  res.status(201).json(await Course.create({ courseType, name: String(name).trim(), durationYears }));
});

module.exports = router;
