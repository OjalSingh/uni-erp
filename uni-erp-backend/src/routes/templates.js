const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const Template = require("../models/Template");
const { KINDS } = require("../models/Template");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { guarded } = require("../lib/util");
const { UPLOAD_DIR } = require("./uploads");

const DIR = path.join(UPLOAD_DIR, "templates");
fs.mkdirSync(DIR, { recursive: true });
const EXT = { "image/jpeg": ".jpg", "image/png": ".png" };

const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + EXT[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(EXT[file.mimetype])),
});

// The file must really be a jpeg or png, not just labelled as one
function looksLikeImage(file) {
  const fd = fs.openSync(file.path, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return (buf[0] === 0xff && buf[1] === 0xd8) || buf.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
}
const removeFile = (rel) => {
  if (rel && rel.startsWith("/uploads/templates/")) fs.promises.unlink(path.join(DIR, path.basename(rel))).catch(() => undefined);
};
const receive = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Template image must be 8 MB or smaller" : "Upload failed" });
    next();
  });

const router = express.Router();
router.use(requireAuth);
const admin = requirePermission("settings:manage");

// Every signed-in user can read the active templates so printing screens can pick the right one;
// head office also sees switched-off ones.
router.get("/", async (req, res) => {
  const filter = req.perms.has("settings:manage") ? {} : { active: true };
  if (req.query.kind && KINDS.includes(req.query.kind)) filter.kind = req.query.kind;
  res.json(await Template.find(filter).populate("course", "name").sort({ kind: 1, session: -1, createdAt: -1 }));
});

const fields = (b) => ({
  ...(b.kind !== undefined && { kind: b.kind }),
  ...(b.name !== undefined && { name: b.name }),
  ...(b.session !== undefined && { session: b.session }),
  ...(b.course !== undefined && { course: b.course || null }),
  ...(b.dx !== undefined && { dx: Number(b.dx) || 0 }),
  ...(b.dy !== undefined && { dy: Number(b.dy) || 0 }),
  ...(b.active !== undefined && { active: b.active === true || b.active === "true" }),
});

router.post("/", admin, receive, (req, res) =>
  guarded(res, async () => {
    if (!req.file || !looksLikeImage(req.file)) {
      if (req.file) removeFile(`/uploads/templates/${req.file.filename}`);
      return res.status(400).json({ message: "Upload a jpg or png image of the full page" });
    }
    try {
      const doc = await Template.create({ ...fields(req.body), image: `/uploads/templates/${req.file.filename}` });
      res.status(201).json(doc);
    } catch (e) {
      removeFile(`/uploads/templates/${req.file.filename}`);
      throw e;
    }
  }, "A template for that document, session and course already exists. Edit or replace it instead.")
);

// Change details, and optionally replace the image
router.put("/:id", admin, receive, (req, res) =>
  guarded(res, async () => {
    const doc = await Template.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Template not found" });
    const data = fields(req.body);
    delete data.kind; // the document type never changes; make a new template instead
    let old;
    if (req.file) {
      if (!looksLikeImage(req.file)) {
        removeFile(`/uploads/templates/${req.file.filename}`);
        return res.status(400).json({ message: "Upload a jpg or png image of the full page" });
      }
      old = doc.image;
      data.image = `/uploads/templates/${req.file.filename}`;
    }
    doc.set(data);
    await doc.save();
    removeFile(old);
    res.json(doc);
  }, "A template for that document, session and course already exists.")
);

router.delete("/:id", admin, async (req, res) => {
  const doc = await Template.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Template not found" });
  await doc.deleteOne();
  removeFile(doc.image);
  res.json({ ok: true });
});

module.exports = router;
