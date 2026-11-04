// Attaches the old portal's student photos to the imported students.
// The SQL dump only holds file names (e.g. 12081892500.jpg); the picture files stay on the old server.
// Copy that photo folder to this computer, then:
//   npm run import-photos -- "C:\path\to\old\photos"            (dry run, shows how many would match)
//   npm run import-photos -- "C:\path\to\old\photos" --apply    (copies the files and links them)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const { UPLOAD_DIR } = require("../routes/uploads");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dir = args.find((a) => !a.startsWith("--"));
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('Give the folder that holds the old photos, e.g. npm run import-photos -- "C:\\old-portal\\photos"');
  process.exit(1);
}

const OK = new Set([".jpg", ".jpeg", ".png", ".gif"]);
const key = (n) => n.trim().toLowerCase();
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (OK.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

(async () => {
  const files = new Map();
  for (const f of walk(dir)) files.set(key(path.basename(f)), f);
  console.log(`Photo files found in the folder: ${files.size}`);

  await mongoose.connect(process.env.MONGO_URI);
  const students = await Student.find({ legacyImage: { $exists: true, $ne: null }, $or: [{ image: { $exists: false } }, { image: "" }, { image: null }] }).select("legacyImage");
  let matched = 0, missing = 0, tooBig = 0;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const s of students) {
    const src = files.get(key(s.legacyImage));
    if (!src) { missing++; continue; }
    if (fs.statSync(src).size > 2 * 1024 * 1024) { tooBig++; continue; }
    matched++;
    if (!apply) continue;
    const name = crypto.randomBytes(16).toString("hex") + path.extname(src).toLowerCase().replace(".jpeg", ".jpg");
    fs.copyFileSync(src, path.join(UPLOAD_DIR, name));
    await Student.updateOne({ _id: s._id }, { $set: { image: `/uploads/${name}` } }); // direct update: skips validators on old records
  }
  console.log(`Students needing a photo: ${students.length}`);
  console.log(`${apply ? "Linked" : "Would link"}: ${matched}   No file in the folder: ${missing}   Skipped, over 2 MB: ${tooBig}`);
  if (!apply) console.log("Dry run only. Add --apply to copy the files and link them.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
