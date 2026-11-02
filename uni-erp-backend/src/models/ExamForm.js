const mongoose = require("mongoose");

const examFormSchema = new mongoose.Schema(
  {
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: "Center", required: true }, // copied from student for scoping
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    part: { type: Number, min: 1, default: 1 },
    medium: { type: String, enum: ["Hindi", "English"], default: "Hindi" },
    rollNo: { type: String, required: true, unique: true },
    status: { type: String, enum: ["Pending", "Accepted", "Denied"], default: "Pending" },
    filledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
examFormSchema.index({ schedule: 1, student: 1, part: 1 }, { unique: true });

module.exports = mongoose.model("ExamForm", examFormSchema);
