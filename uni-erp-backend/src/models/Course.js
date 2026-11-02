const mongoose = require("mongoose");

// Course types (e.g. Diploma) and courses (e.g. N.T.T One Year) share one small file
const courseTypeSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true } });

const courseSchema = new mongoose.Schema(
  {
    courseType: { type: mongoose.Schema.Types.ObjectId, ref: "CourseType", required: true },
    name: { type: String, required: true, trim: true },
    durationYears: { type: Number },
  },
  { timestamps: true }
);

module.exports = {
  CourseType: mongoose.model("CourseType", courseTypeSchema),
  Course: mongoose.model("Course", courseSchema),
};
