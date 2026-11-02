const mongoose = require("mongoose");

const qualificationSchema = new mongoose.Schema(
  { examination: String, board: String, year: String, division: String },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    enrollNo: { type: String, required: true, unique: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: "Center", required: true },
    session: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // e.g. 2025-26
    examTerm: { type: String, enum: ["May-June", "Nov-Dec"], required: true },
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    courseType: { type: mongoose.Schema.Types.ObjectId, ref: "CourseType", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    gender: { type: String, enum: ["Male", "Female", "Transgender"], required: true },
    dob: { type: Date, required: true },
    nationality: { type: String, required: true, trim: true },
    address: String,
    state: String,
    city: String,
    pinCode: String,
    image: String, // stored file path/URL
    qualifications: { type: [qualificationSchema], default: [] }, // up to 6 rows in the original form
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

studentSchema.index({ session: 1, center: 1 });

module.exports = mongoose.model("Student", studentSchema);
