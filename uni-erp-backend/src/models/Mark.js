const mongoose = require("mongoose");

const subjectMarkSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    code: String, // paper number, e.g. "II"
    type: { type: String, enum: ["Theory", "Practical"], required: true },
    maxMarks: Number,
    marks: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

// Marks are entered per exam form (so only students with an accepted form can have marks)
const markSchema = new mongoose.Schema(
  {
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    // Optional only for history imported from the old system, where some results have no recorded form
    examForm: { type: mongoose.Schema.Types.ObjectId, ref: "ExamForm" },
    rollNo: { type: String },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    part: { type: Number, default: 1 },
    theoryMarks: { type: Number, min: [0, "Marks cannot be negative"], default: 0 },
    practicalMarks: { type: Number, min: [0, "Marks cannot be negative"], default: 0 },
    // Subject-by-subject marks (kept from the old system); theory and practical totals above are their sums
    subjectMarks: { type: [subjectMarkSchema], default: undefined },
  },
  { timestamps: true }
);

markSchema.virtual("totalMarks").get(function () {
  return this.theoryMarks + this.practicalMarks;
});
markSchema.set("toJSON", { virtuals: true });
markSchema.index({ schedule: 1, student: 1, part: 1 }, { unique: true });

module.exports = mongoose.model("Mark", markSchema);
