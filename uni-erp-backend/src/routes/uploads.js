const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { requireAuth, requirePermission } = require("../middleware/auth");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif" };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Random server-chosen name; the client's filename is never used
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype])),
});

const router = express.Router();

router.post("/photo", requireAuth, requirePermission("students:create", "students:edit"), (req, res) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Photo must be 500 KB or smaller" : "Upload failed";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "Only gif, jpeg, jpg or png images are allowed" });
    res.status(201).json({ path: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
