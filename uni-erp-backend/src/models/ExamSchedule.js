const mongoose = require("mongoose");

// One exam sitting, e.g. "May-June 2026", with the window in which centers may fill exam forms
const examScheduleSchema = new mongoose.Schema(
  {
    examId: { type: Number, required: true, unique: true },
    examTerm: { type: String, enum: ["May-June", "Nov-Dec"], required: true },
    year: { type: Number, required: true },
    session: { type: String, trim: true }, // e.g. 2024-25, as recorded by the old system
    formStart: { type: Date, required: true },
    formEnd: { type: Date, required: true },
  },
  { timestamps: true }
);

examScheduleSchema.pre("validate", function () {
  if (this.formEnd < this.formStart) this.invalidate("formEnd", "Form end date must be on or after the start date");
});

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);
