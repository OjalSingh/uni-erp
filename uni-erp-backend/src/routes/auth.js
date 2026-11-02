const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const user = await User.findOne({ username: String(username).trim().toLowerCase() }).select("+password");
  // One message for unknown user / wrong password avoids leaking which usernames exist
  if (!user || !user.active || !(await user.checkPassword(password))) {
    return res.status(401).json({ message: "Username or password is incorrect." });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
  res.json({ token, user });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.checkPassword(currentPassword || ""))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated" });
});

module.exports = router;
