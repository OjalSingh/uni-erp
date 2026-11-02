const express = require("express");
const Center = require("../models/Center");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded } = require("../lib/util");

const router = express.Router();
router.use(requireAuth);

const FIELDS = [
  "code", "name", "address", "state", "city", "pinCode", "email", "mobile", "qualification",
  "instituteProperty", "currentOccupation", "ownerFirstName", "ownerLastName", "ownerMobile", "ownerEmail", "status",
];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body?.[f] !== undefined && body[f] !== "").map((f) => [f, body[f]]));

router.get("/", async (req, res) => {
  const filter = req.user.role === "center" ? { _id: req.user.center } : {};
  res.json(await Center.find(filter).sort({ code: 1 }));
});

router.get("/:id", async (req, res) => {
  if (req.user.role === "center" && String(req.user.center) !== req.params.id) return res.status(403).json({ message: "You do not have access to this resource" });
  const c = await Center.findById(req.params.id);
  return c ? res.json(c) : res.status(404).json({ message: "Center not found" });
});

router.post("/", requireRole("admin"), (req, res) =>
  guarded(res, async () => res.status(201).json(await Center.create(pick(req.body))), "Center code already exists")
);

router.put("/:id", requireRole("admin"), (req, res) =>
  guarded(res, async () => {
    // Blank fields clear the stored value; the code stays fixed once created
    const body = Object.fromEntries(FIELDS.filter((f) => f !== "code" && req.body?.[f] !== undefined).map((f) => [f, req.body[f] === "" ? undefined : req.body[f]]));
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center not found" });
    center.set(body);
    await center.save();
    res.json(center);
  })
);

// Soft delete: students and invoices keep their center reference
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const center = await Center.findByIdAndUpdate(req.params.id, { status: "Inactive" }, { new: true });
  if (!center) return res.status(404).json({ message: "Center not found" });
  res.json({ message: "Center deactivated" });
});

module.exports = router;
