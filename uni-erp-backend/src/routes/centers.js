const express = require("express");
const Center = require("../models/Center");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const filter = req.user.role === "center" ? { _id: req.user.center } : {};
  res.json(await Center.find(filter).sort({ code: 1 }));
});

router.post("/", requireRole("admin"), async (req, res) => {
  const { code, name, email, mobile } = req.body || {};
  if (!code || !name) return res.status(400).json({ message: "Center code and name are required" });
  try {
    res.status(201).json(await Center.create({ code, name, email, mobile }));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Center code already exists" });
    throw e;
  }
});

router.put("/:id", requireRole("admin"), async (req, res) => {
  const { name, email, mobile, status } = req.body || {};
  const center = await Center.findByIdAndUpdate(req.params.id, { name, email, mobile, status }, { new: true, runValidators: true });
  if (!center) return res.status(404).json({ message: "Center not found" });
  res.json(center);
});

// Soft delete: students keep their center reference
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const center = await Center.findByIdAndUpdate(req.params.id, { status: "Inactive" }, { new: true });
  if (!center) return res.status(404).json({ message: "Center not found" });
  res.json({ message: "Center deactivated" });
});

module.exports = router;
