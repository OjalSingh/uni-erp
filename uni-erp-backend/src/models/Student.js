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
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits and start with 6, 7, 8 or 9"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    courseType: { type: mongoose.Schema.Types.ObjectId, ref: "CourseType", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    gender: { type: String, enum: ["Male", "Female", "Transgender"], required: true },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: (d) => {
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 18);
          return d <= cutoff;
        },
        message: "Student must be at least 18 years old",
      },
    },
    nationality: { type: String, required: true, trim: true },
    address: String,
    state: String,
    city: String,
    pinCode: { type: String, trim: true, match: [/^\d{6}$/, "Pin code must be 6 digits"] },
    image: String, // stored file path/URL
    legacyImage: String, // photo file name from the old system; the file itself must be copied separately
    legacyEnrollNo: String, // the old number, kept when two students shared it and this one was given a new number
    qualifications: { type: [qualificationSchema], default: [] }, // up to 6 rows in the original form
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

studentSchema.index({ session: 1, center: 1 });

module.exports = mongoose.model("Student", studentSchema);
