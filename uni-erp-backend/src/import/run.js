// Imports an old-system MySQL dump into MongoDB.
//   npm run import-sql -- path/to/dump.sql            dry run: reads the file, reports, writes nothing to the database
//   npm run import-sql -- path/to/dump.sql --apply    writes to the database in MONGO_URI
//   add --replace to import again after a previous import (removes only previously imported records)
const fs = require("fs");
const path = require("path");
const { parseDump } = require("./dump");
const { transform } = require("./transform");
const { writeAll } = require("./write");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const replace = args.includes("--replace");

const csv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n") + "\n";

(async () => {
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run import-sql -- path/to/dump.sql [--apply] [--replace]');
    process.exit(1);
  }
  const outDir = path.join(__dirname, "..", "..", "import-output");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Reading ${path.basename(file)} ...`);
  const { data } = parseDump(file);
  const result = transform(data);

  console.log("\nWhat the file contains (records ready to import):");
  for (const [k, n] of Object.entries(result.report.counts)) console.log(`  ${k.padEnd(14)} ${n}`);
  if (Object.keys(result.report.skipped).length) {
    console.log("\nLeft out:");
    for (const [k, n] of Object.entries(result.report.skipped)) console.log(`  ${n} ${k}`);
  }
  console.log("\nNotes:");
  for (const n of result.report.notes) console.log("  - " + n);
  console.log(`\n${result.attention.length} students would not pass today's entry rules (listed by id in import-output/needs-attention.csv).`);
  console.log(`${result.duplicateEnrollments.length} enrollment numbers were shared by two students; the second student of each pair is given a new number in the normal format (import-output/duplicate-enrollments.csv).`);

  fs.writeFileSync(path.join(outDir, "needs-attention.csv"), csv(result.attention, ["sid", "enrollment_no", "issues"]));
  fs.writeFileSync(path.join(outDir, "duplicate-enrollments.csv"), csv(result.duplicateEnrollments, ["enrollment_no", "kept_sid", "renamed_sid", "new_enrollment_no"]));

  if (!apply) {
    console.log("\nDry run only: nothing was written to the database. Add --apply to import.");
    return;
  }

  require("dotenv").config(); // only needed to find MONGO_URI
  const mongoose = require("mongoose");
  const bcrypt = require("bcrypt");
  const { State, City, FinancialYear, Role } = require("../models/Config");
  const { CourseType, Course, Subject } = require("../models/Course");
  const Center = require("../models/Center");
  const User = require("../models/User");
  const Student = require("../models/Student");
  const ExamSchedule = require("../models/ExamSchedule");
  const ExamForm = require("../models/ExamForm");
  const Mark = require("../models/Mark");
  const PartOneMark = require("../models/PartOneMark");
  const ResultPublish = require("../models/ResultPublish");
  const Invoice = require("../models/Invoice");
  const { Supplier, Item, StockEntry } = require("../models/Inventory");

  const models = { state: State, city: City, financialYear: FinancialYear, courseType: CourseType, course: Course, subject: Subject, center: Center, user: User, student: Student, examSchedule: ExamSchedule, examForm: ExamForm, mark: Mark, partOneMark: PartOneMark, resultPublish: ResultPublish, supplier: Supplier, item: Item, stockEntry: StockEntry, invoice: Invoice, role: Role };
  const names = Object.fromEntries(Object.entries(models).map(([k, m]) => [k, m.collection.name]));

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nWriting to database "${mongoose.connection.name}" ...`);
  // Indexes changed in this version (exam roll numbers, subjects); bring the database in line before inserting
  for (const m of Object.values(models)) await m.syncIndexes();

  const db = { col: (name) => mongoose.connection.db.collection(name) };
  // Names are looked up by key above; db.col takes the real collection name
  const out = await writeAll(result, { db, names, newId: () => new mongoose.Types.ObjectId(), hash: (p) => bcrypt.hash(p, 10), replace, log: console.log });

  if (out.credentials.length) {
    const file = path.join(outDir, "new-passwords.csv");
    fs.writeFileSync(file, csv(out.credentials, ["username", "password"]), { mode: 0o600 });
    console.log(`\n${out.credentials.length} users were created with new random passwords: import-output/new-passwords.csv`);
    console.log("Give each person their password, ask them to change it (Change Password), then delete that file.");
  }
  for (const w of [...new Set(out.warnings)].slice(0, 20)) console.log("  warning: " + w);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ counts: result.report.counts, written: out.stats, warnings: out.warnings }, null, 2));
  console.log("\nDone. The seeded demo logins (admin / center1001) still exist: delete them before real use.");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("\nImport stopped: " + e.message);
  process.exit(1);
});
