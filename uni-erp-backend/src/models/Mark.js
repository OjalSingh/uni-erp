const mongoose = require("mongoose");

const markSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    rollNo: { type: String, required: true },
    session: String,
    examTerm: { type: String, enum: ["May-June", "Nov-Dec"], required: true },
    year: { type: Number, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    part: { type: Number, default: 1 },
    theoryMarks: { type: Number, min: 0, default: 0 },
    practicalMarks: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

markSchema.virtual("totalMarks").get(function () {
  return this.theoryMarks + this.practicalMarks;
});
markSchema.set("toJSON", { virtuals: true });
markSchema.index({ student: 1, examTerm: 1, year: 1, part: 1 }, { unique: true });

module.exports = mongoose.model("Mark", markSchema);
