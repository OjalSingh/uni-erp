const mongoose = require("mongoose");

// Marks are entered per exam form (so only students with an accepted form can have marks)
const markSchema = new mongoose.Schema(
  {
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    examForm: { type: mongoose.Schema.Types.ObjectId, ref: "ExamForm", required: true },
    rollNo: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    part: { type: Number, default: 1 },
    theoryMarks: { type: Number, min: [0, "Marks cannot be negative"], default: 0 },
    practicalMarks: { type: Number, min: [0, "Marks cannot be negative"], default: 0 },
  },
  { timestamps: true }
);

markSchema.virtual("totalMarks").get(function () {
  return this.theoryMarks + this.practicalMarks;
});
markSchema.set("toJSON", { virtuals: true });
markSchema.index({ schedule: 1, student: 1, part: 1 }, { unique: true });

module.exports = mongoose.model("Mark", markSchema);
