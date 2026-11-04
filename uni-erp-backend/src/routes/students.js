const express = require("express");
const Student = require("../models/Student");
const { requireAuth, requirePermission, centerScope } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const validationMessage = (e) => Object.values(e.errors).map((x) => x.message).join(". ");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Enrollment no. = 2-digit start year of the session + 5-digit running number, e.g. 2451098
async function nextEnrollNo(session) {
  const prefix = session.slice(2, 4);
  const last = await Student.findOne({ enrollNo: new RegExp(`^${prefix}\\d{5}$`) }).sort({ enrollNo: -1 }).select("enrollNo");
  const seq = last ? parseInt(last.enrollNo.slice(2), 10) + 1 : 1;
  return prefix + String(seq).padStart(5, "0");
}

router.get("/next-enroll-no", requirePermission("students:create"), async (req, res) => {
  const { session } = req.query;
  if (!/^\d{4}-\d{2}$/.test(session || "")) return res.status(400).json({ message: "session must look like 2025-26" });
  res.json({ enrollNo: await nextEnrollNo(session) });
});

// Active students for ID card printing (max 200 per request)
router.get("/id-cards", requirePermission("idcards:print"), async (req, res) => {
  const { session, center, search = "" } = req.query;
  if (!session) return res.status(400).json({ message: "Choose a session" });
  const filter = { session, status: "Active", ...centerScope(req) };
  if (center && req.user.role === "admin") filter.center = center;
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), "i");
    filter.$or = [{ enrollNo: rx }, { name: rx }];
  }
  res.json(
    await Student.find(filter).sort({ enrollNo: 1 }).limit(200)
      .select("enrollNo name fatherName dob mobile image session center course address city pinCode")
      .populate("center", "code name").populate("course", "name")
  );
});

// List by session with search + pagination (the DataTable on the original page)
router.get("/", requirePermission("students:view"), async (req, res) => {
  const { session, search = "", page = 1, limit = 10 } = req.query;
  const filter = { ...centerScope(req) };
  if (session) filter.session = session;
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), "i");
    filter.$or = [{ enrollNo: rx }, { name: rx }, { mobile: rx }];
  }
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Student.find(filter)
      .sort({ enrollNo: 1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate("center", "code name")
      .populate("course", "name"),
    Student.countDocuments(filter),
  ]);
  res.json({ items, total, page: p, pages: Math.ceil(total / l) });
});

router.get("/:id", requirePermission("students:view", "students:edit"), async (req, res) => {
  const s = await Student.findOne({ _id: req.params.id, ...centerScope(req) })
    .populate("center", "code name")
    .populate("courseType", "name")
    .populate("course", "name");
  if (!s) return res.status(404).json({ message: "Student not found" });
  res.json(s);
});

router.post("/", requirePermission("students:create"), async (req, res) => {
  const body = { ...req.body };
  // Center logins can only register into their own center
  if (req.user.role === "center") body.center = req.user.center;
  if (!/^\d{4}-\d{2}$/.test(body.session || "")) return res.status(400).json({ message: "Valid session is required" });
  delete body.enrollNo;
  delete body._id;
  if (body.image && !/^\/uploads\/[a-f0-9]{32}\.(jpg|png|gif)$/.test(body.image)) delete body.image;

  // Retry once on enrollNo collision from concurrent registrations
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      body.enrollNo = await nextEnrollNo(body.session);
      return res.status(201).json(await Student.create(body));
    } catch (e) {
      if (e.name === "ValidationError") return res.status(400).json({ message: validationMessage(e) });
      if (e.code !== 11000 || attempt === 1) throw e;
    }
  }
});

router.put("/:id", requirePermission("students:edit"), async (req, res) => {
  const body = { ...req.body };
  delete body.enrollNo; // never changes after registration
  delete body._id;
  if (req.user.role === "center") delete body.center;
  if (body.image && !/^\/uploads\/[a-f0-9]{32}\.(jpg|png|gif)$/.test(body.image)) delete body.image;
  try {
    const s = await Student.findOneAndUpdate({ _id: req.params.id, ...centerScope(req) }, body, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ message: "Student not found" });
    res.json(s);
  } catch (e) {
    if (e.name === "ValidationError") return res.status(400).json({ message: validationMessage(e) });
    throw e;
  }
});

// Soft delete so marks/certificates tied to the student are never orphaned
router.delete("/:id", requirePermission("students:deactivate"), async (req, res) => {
  const s = await Student.findOneAndUpdate({ _id: req.params.id, ...centerScope(req) }, { status: "Inactive" }, { new: true });
  if (!s) return res.status(404).json({ message: "Student not found" });
  res.json({ message: "Student deactivated" });
});

module.exports = router;
