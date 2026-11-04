// Loads the supplied certificate / mark statement stationery (seed-templates/*.jpg) as print templates.
// Safe to run again: templates that already exist are left alone.   npm run seed-templates
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Template = require("./models/Template");
const { UPLOAD_DIR } = require("./routes/uploads");

const SRC = path.join(__dirname, "..", "seed-templates");
const DEST = path.join(UPLOAD_DIR, "templates");
// Small nudges (mm) for stationery whose printed lines sit a little differently from the usual grid
const NUDGE = { "2019-20_1y_certificate": { dy: 3.5 }, "2019-20_1y_statement": { dy: 3.5 } };
const KIND = { certificate: "certificate", statement: "statement" };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Template.syncIndexes();
  fs.mkdirSync(DEST, { recursive: true });
  let made = 0;
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith(".jpg")).sort()) {
    const base = file.replace(/\.jpg$/, "");
    const [session, dur, kind] = base.split("_");
    const duration = Number(dur.replace("y", ""));
    const where = { kind: KIND[kind], session, course: null, duration };
    if (await Template.exists(where)) continue;
    const name = crypto.randomBytes(16).toString("hex") + ".jpg";
    fs.copyFileSync(path.join(SRC, file), path.join(DEST, name));
    await Template.create({
      ...where,
      name: `${session} ${duration === 1 ? "One year" : "Two years"} ${kind}`,
      image: `/uploads/templates/${name}`,
      ...(NUDGE[base] || {}),
    });
    made++;
  }
  console.log(`Templates added: ${made}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
