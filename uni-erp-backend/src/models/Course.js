const mongoose = require("mongoose");

// Course types (e.g. Diploma), courses (e.g. N.T.T One Year) and their subjects
const courseTypeSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true } });

const courseSchema = new mongoose.Schema(
  {
    courseType: { type: mongoose.Schema.Types.ObjectId, ref: "CourseType", required: true },
    name: { type: String, required: true, trim: true },
    // Short numeric code, used as the first digits of roll numbers
    code: { type: String, trim: true, match: [/^\d{1,2}$/, "Course code must be 1 or 2 digits"] },
    parts: { type: Number, min: 1, max: 6, default: 1 },
    durationYears: { type: Number },
  },
  { timestamps: true }
);

const subjectSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    part: { type: Number, min: 1, default: 1 },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    type: { type: String, enum: ["Theory", "Practical"] },
    maxMarks: { type: Number, min: 0 },
  },
  { timestamps: true }
);
subjectSchema.index({ course: 1, part: 1, name: 1, type: 1 }, { unique: true });

module.exports = {
  CourseType: mongoose.model("CourseType", courseTypeSchema),
  Course: mongoose.model("Course", courseSchema),
  Subject: mongoose.model("Subject", subjectSchema),
};
