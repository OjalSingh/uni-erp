const express = require("express");
const Student = require("../models/Student");
const { requireAuth, centerScope } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Matches the "Application Analytics" tiles: total students and registrations this month
router.get("/", async (req, res) => {
  const scope = centerScope(req);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalStudents, registrationsThisMonth] = await Promise.all([
    Student.countDocuments(scope),
    Student.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
  ]);
  res.json({ totalStudents, registrationsThisMonth });
});

module.exports = router;
