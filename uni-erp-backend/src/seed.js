require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Center = require("./models/Center");
const { CourseType, Course } = require("./models/Course");
const { State, FinancialYear, Menu, SubMenu, Role } = require("./models/Config");
const { SCREENS, MISC_SCREENS, CENTER_MENUS, ALL_MENUS } = require("./lib/screens");

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

  await Role.updateOne({ key: "admin" }, { $setOnInsert: { key: "admin", name: "Super Admin", baseRole: "admin", menus: ALL_MENUS, active: true, system: true } }, { upsert: true });
  await Role.updateOne({ key: "center" }, { $setOnInsert: { key: "center", name: "Center", baseRole: "center", menus: CENTER_MENUS, active: true, system: true } }, { upsert: true });
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

  const adminRole = await Role.findOne({ key: "admin" });
  const centerRole = await Role.findOne({ key: "center" });
  const accounts = [
    { username: "admin", name: "Head Office", role: "admin", roleRef: adminRole._id, center: head._id, password: "admin@12345" },
    { username: "center1001", name: "Demo Center", role: "center", roleRef: centerRole._id, center: demo._id, password: "center@12345" },
  ];
  for (const a of accounts) {
    await User.deleteOne({ username: a.username });
    await User.create(a);
  }
  console.log("Seeded dev accounts: admin / center1001 (see src/seed.js)");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
