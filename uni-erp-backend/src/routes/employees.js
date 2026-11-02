const express = require("express");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded } = require("../lib/util");

// "Employee Details" in the original portal = people who can log in
const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req, res) => res.json(await User.find().populate("center", "code name").sort({ createdAt: 1 })));

router.post("/", (req, res) => {
  const { username, name, email, mobile, role, center, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  if (role === "center" && !center) return res.status(400).json({ message: "Choose a center for a center login" });
  return guarded(
    res,
    async () => res.status(201).json(await User.create({ username, name, email, mobile, role, center: role === "center" ? center : undefined, password })),
    "That username is already taken"
  );
});

router.put("/:id", (req, res) => {
  const { name, email, mobile, role, center, active, password } = req.body || {};
  if (req.params.id === req.user.id && (active === false || (role && role !== req.user.role))) {
    return res.status(400).json({ message: "You cannot deactivate or change the role of your own account" });
  }
  if (password && password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  if (role === "center" && !center) return res.status(400).json({ message: "Choose a center for a center login" });

  return guarded(res, async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    Object.assign(user, { name, email, mobile, role, active });
    user.center = role === "center" ? center : undefined;
    if (password) user.password = password; // hashed by the model's pre-save hook
    await user.save();
    res.json(user);
  });
});

module.exports = router;
