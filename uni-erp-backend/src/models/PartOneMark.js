const mongoose = require("mongoose");

// Part 1 result summary for two-part courses (kept from the old system, where Part 2 results show it)
const partOneMarkSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    totalMarks: { type: Number, min: 0, required: true },
    obtainedMarks: { type: Number, min: 0, required: true },
  },
  { timestamps: true }
);
partOneMarkSchema.index({ student: 1, schedule: 1 }, { unique: true });

module.exports = mongoose.model("PartOneMark", partOneMarkSchema);
