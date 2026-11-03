require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Center = require("./models/Center");
const { CourseType, Course } = require("./models/Course");
const { State, FinancialYear, Menu, SubMenu, Role } = require("./models/Config");
const { SCREENS, MISC_SCREENS } = require("./lib/screens");
const { ROLE_DEFAULTS } = require("./lib/permissions");
const crypto = require("crypto");

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// Safe to run repeatedly: existing configuration is kept, missing defaults are added.
async function seedConfig() {
  for (const name of STATES) await State.updateOne({ name }, { $setOnInsert: { name, active: true } }, { upsert: true });

  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 3; y <= thisYear; y++) {
    const label = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    await FinancialYear.updateOne({ label }, { $setOnInsert: { label, current: y === thisYear } }, { upsert: true });
  }

  let order = 0;
  for (const s of SCREENS) {
    order += 10;
    await Menu.updateOne({ key: s.key }, { $setOnInsert: { key: s.key, label: s.label, group: s.group, order, active: true, system: true } }, { upsert: true });
  }
  const misc = await Menu.findOne({ key: "misc" });
  order = 0;
  for (const label of MISC_SCREENS) {
    order += 10;
    await SubMenu.updateOne({ menu: misc._id, label }, { $setOnInsert: { menu: misc._id, label, order, active: true, system: true } }, { upsert: true });
  }

  // The six user levels. A role you have already customised keeps its permissions; Super Admin always gets everything (including new features).
  for (const def of ROLE_DEFAULTS) {
    const existing = await Role.findOne({ key: def.key }).lean();
    if (!existing) {
      await Role.create({ key: def.key, name: def.name, baseRole: def.baseRole, permissions: def.permissions, active: true, system: Boolean(def.system) });
    } else if (def.key === "admin") {
      await Role.updateOne({ key: "admin" }, { $set: { permissions: def.permissions } });
    } else if (!existing.permissions) {
      await Role.updateOne({ key: def.key }, { $set: { permissions: def.permissions, name: def.name } }); // first migration from the old menu-only roles
    }
  }
}

// Local-development seed only. Never use these credentials anywhere real.
(async () => {
  await connectDB();
  await seedConfig();

  const head = await Center.findOneAndUpdate({ code: "1" }, { code: "1", name: "AIECCE", status: "Active" }, { upsert: true, new: true });
  const demo = await Center.findOneAndUpdate({ code: "1001" }, { code: "1001", name: "Demo Study Center", status: "Active" }, { upsert: true, new: true });

  const diploma = await CourseType.findOneAndUpdate({ name: "Diploma" }, { name: "Diploma" }, { upsert: true, new: true });
  await Course.findOneAndUpdate(
    { name: "Nursery Teacher Training (N.T.T) - One Year" },
    { courseType: diploma._id, name: "Nursery Teacher Training (N.T.T) - One Year", durationYears: 1, code: "24", parts: 2 },
    { upsert: true }
  );

  const roleBy = Object.fromEntries((await Role.find().lean()).map((r) => [r.key, r]));
  const fixed = [
    { username: "admin", name: "Head Office", roleKey: "admin", center: head._id, password: "admin@12345" },
    { username: "center1001", name: "Demo Center", roleKey: "center", center: demo._id, password: "center@12345" },
  ];
  for (const a of fixed) {
    await User.deleteOne({ username: a.username });
    await User.create({ username: a.username, name: a.name, role: roleBy[a.roleKey].baseRole, roleRef: roleBy[a.roleKey]._id, center: a.center, password: a.password });
  }

  // One test login for every other level. Passwords are random, shown once here, and not stored anywhere else.
  const levels = [
    { username: "headadmin", name: "Test Admin", roleKey: "head-admin", center: head._id },
    { username: "staff", name: "Test Normal User", roleKey: "staff", center: head._id },
    { username: "guest", name: "Test Guest", roleKey: "guest", center: head._id },
    { username: "centerstaff", name: "Test Center Staff", roleKey: "center-staff", center: demo._id },
  ];
  const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const created = [];
  for (const l of levels) {
    if (await User.exists({ username: l.username })) continue;
    const password = Array.from({ length: 12 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
    await User.create({ username: l.username, name: l.name, role: roleBy[l.roleKey].baseRole, roleRef: roleBy[l.roleKey]._id, center: l.center, password });
    created.push({ username: l.username, level: roleBy[l.roleKey].name, password });
  }
  console.log("Seeded dev accounts: admin / center1001 (see src/seed.js)");
  if (created.length) {
    console.log("\nNew test logins (shown once, so note them now):");
    for (const c of created) console.log(`  ${c.username.padEnd(12)} ${c.level.padEnd(18)} ${c.password}`);
    console.log("Center-level test logins belong to the demo center; point them at a real center in Employee Details to test with real data.");
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
