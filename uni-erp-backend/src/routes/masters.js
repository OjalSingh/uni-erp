const express = require("express");
const { CourseType, Course, Subject } = require("../models/Course");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded } = require("../lib/util");

const router = express.Router();
router.use(requireAuth);

// ----- Course types -----
router.get("/course-types", async (_req, res) => res.json(await CourseType.find().sort({ name: 1 })));

router.post("/course-types", requireRole("admin"), (req, res) =>
  guarded(
    res,
    async () => res.status(201).json(await CourseType.create({ name: req.body?.name })),
    "Course type already exists"
  )
);

router.put("/course-types/:id", requireRole("admin"), (req, res) =>
  guarded(
    res,
    async () => {
      const t = await CourseType.findByIdAndUpdate(req.params.id, { name: req.body?.name }, { new: true, runValidators: true });
      return t ? res.json(t) : res.status(404).json({ message: "Course type not found" });
    },
    "Course type already exists"
  )
);

// ----- Courses -----  (?courseType=<id> powers the dependent dropdown)
router.get("/courses", async (req, res) => {
  const filter = req.query.courseType ? { courseType: req.query.courseType } : {};
  res.json(await Course.find(filter).populate("courseType", "name").sort({ name: 1 }));
});

router.post("/courses", requireRole("admin"), (req, res) => {
  const { courseType, name, code, parts, durationYears } = req.body || {};
  return guarded(res, async () => res.status(201).json(await Course.create({ courseType, name, code, parts, durationYears })));
});

router.put("/courses/:id", requireRole("admin"), (req, res) => {
  const { courseType, name, code, parts, durationYears } = req.body || {};
  return guarded(res, async () => {
    const c = await Course.findByIdAndUpdate(req.params.id, { courseType, name, code, parts, durationYears }, { new: true, runValidators: true });
    return c ? res.json(c) : res.status(404).json({ message: "Course not found" });
  });
});

// ----- Subjects -----
router.get("/subjects", async (req, res) => {
  const filter = {};
  if (req.query.course) filter.course = req.query.course;
  if (req.query.part) filter.part = Number(req.query.part);
  res.json(await Subject.find(filter).populate("course", "name").sort({ part: 1, name: 1 }));
});

router.post("/subjects", requireRole("admin"), (req, res) => {
  const { course, part, name, code, type, maxMarks } = req.body || {};
  return guarded(res, async () => res.status(201).json(await Subject.create({ course, part, name, code, type, maxMarks })), "That subject already exists for this course and part");
});

router.put("/subjects/:id", requireRole("admin"), (req, res) => {
  const { part, name, code, type, maxMarks } = req.body || {};
  return guarded(res, async () => {
    const s = await Subject.findByIdAndUpdate(req.params.id, { part, name, code, type, maxMarks }, { new: true, runValidators: true });
    return s ? res.json(s) : res.status(404).json({ message: "Subject not found" });
  }, "That subject already exists for this course and part");
});

module.exports = router;
