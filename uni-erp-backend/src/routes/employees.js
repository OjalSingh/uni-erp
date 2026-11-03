const express = require("express");
const User = require("../models/User");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { guarded } = require("../lib/util");
const { Role } = require("../models/Config");
const { effectivePermissions } = require("../lib/permissions");

// Nobody can hand out more access than they hold themselves
const withinOwn = (req, role) => effectivePermissions(role).every((p) => req.perms.has(p));

// "Employee Details" in the original portal = people who can log in
const router = express.Router();
router.use(requireAuth, requirePermission("employees:manage"));

router.get("/", async (_req, res) => res.json(await User.find().populate("center", "code name").populate("roleRef", "key name").sort({ createdAt: 1 })));

router.post("/", (req, res) => {
  const { username, name, email, mobile, roleKey, center, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  return guarded(
    res,
    async () => {
      const role = await Role.findOne({ key: roleKey, active: true });
      if (!role) return res.status(400).json({ message: "Choose an active role" });
      if (!withinOwn(req, role)) return res.status(403).json({ message: "You cannot give someone more access than you have" });
      if (role.baseRole === "center" && !center) return res.status(400).json({ message: "Choose a center for a center login" });
      const user = await User.create({ username, name, email, mobile, role: role.baseRole, roleRef: role._id, center: role.baseRole === "center" ? center : undefined, password });
      res.status(201).json(user);
    },
    "That username is already taken"
  );
});

router.put("/:id", (req, res) => {
  const { name, email, mobile, roleKey, center, active, password } = req.body || {};
  if (password && password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

  return guarded(res, async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const role = roleKey ? await Role.findOne({ key: roleKey, active: true }) : null;
    if (roleKey && !role) return res.status(400).json({ message: "Choose an active role" });
    if (role && !withinOwn(req, role)) return res.status(403).json({ message: "You cannot give someone more access than you have" });
    const base = role ? role.baseRole : user.role;
    if (req.params.id === req.user.id && (active === false || base !== req.user.role)) {
      return res.status(400).json({ message: "You cannot deactivate your own account or change its access level" });
    }
    if (base === "center" && !(center || user.center)) return res.status(400).json({ message: "Choose a center for a center login" });

    Object.assign(user, { name, email, mobile, active });
    if (role) { user.role = role.baseRole; user.roleRef = role._id; }
    user.center = base === "center" ? center || user.center : undefined;
    if (password) user.password = password; // hashed by the model's pre-save hook
    await user.save();
    res.json(user);
  });
});

module.exports = router;
