require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Center = require("./models/Center");
const { CourseType, Course } = require("./models/Course");

// Local-development seed only. Never use these credentials anywhere real.
(async () => {
  await connectDB();

  const head = await Center.findOneAndUpdate({ code: "1" }, { code: "1", name: "AIECCE", status: "Active" }, { upsert: true, new: true });
  const demo = await Center.findOneAndUpdate({ code: "1001" }, { code: "1001", name: "Demo Study Center", status: "Active" }, { upsert: true, new: true });

  const diploma = await CourseType.findOneAndUpdate({ name: "Diploma" }, { name: "Diploma" }, { upsert: true, new: true });
  await Course.findOneAndUpdate(
    { name: "Nursery Teacher Training (N.T.T) - One Year" },
    { courseType: diploma._id, name: "Nursery Teacher Training (N.T.T) - One Year", durationYears: 1, code: "24", parts: 2 },
    { upsert: true }
  );

  const accounts = [
    { username: "admin", name: "Head Office", role: "admin", center: head._id, password: "admin@12345" },
    { username: "center1001", name: "Demo Center", role: "center", center: demo._id, password: "center@12345" },
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
