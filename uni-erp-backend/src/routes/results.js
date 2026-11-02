const express = require("express");
const ResultPublish = require("../models/ResultPublish");
const ExamForm = require("../models/ExamForm");
const Mark = require("../models/Mark");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded, nextNumber } = require("../lib/util");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req, res) => {
  const rows = await ResultPublish.find().sort({ publishId: -1 }).populate("schedule", "examId examTerm year");
  const out = await Promise.all(
    rows.map(async (r) => {
      const [formsFilled, marksAdded] = await Promise.all([
        ExamForm.countDocuments({ schedule: r.schedule._id, status: "Accepted" }),
        Mark.countDocuments({ schedule: r.schedule._id }),
      ]);
      return { ...r.toJSON(), formsFilled, marksAdded, publishedCount: r.published ? marksAdded : 0, unpublishedCount: r.published ? 0 : marksAdded };
    })
  );
  res.json(out);
});

router.post("/", (req, res) => {
  const { schedule, comments, publishDate, endDate } = req.body || {};
  return guarded(res, async () => {
    const publishId = await nextNumber(ResultPublish, "publishId");
    res.status(201).json(await ResultPublish.create({ publishId, schedule, comments, publishDate, endDate }));
  });
});

router.put("/:id", (req, res) => {
  const { comments, publishDate, endDate } = req.body || {};
  return guarded(res, async () => {
    const r = await ResultPublish.findById(req.params.id);
    if (!r) return res.status(404).json({ message: "Result entry not found" });
    Object.assign(r, { comments, publishDate, endDate });
    await r.save();
    res.json(r);
  });
});

// Publishing needs marks to exist, so an empty result is never released by mistake
router.post("/:id/publish", async (req, res) => {
  const r = await ResultPublish.findById(req.params.id);
  if (!r) return res.status(404).json({ message: "Result entry not found" });
  if ((await Mark.countDocuments({ schedule: r.schedule })) === 0) return res.status(400).json({ message: "No marks have been entered for this schedule" });
  r.published = true;
  await r.save();
  res.json(r);
});

router.post("/:id/unpublish", async (req, res) => {
  const r = await ResultPublish.findByIdAndUpdate(req.params.id, { published: false }, { new: true });
  if (!r) return res.status(404).json({ message: "Result entry not found" });
  res.json(r);
});

module.exports = router;
