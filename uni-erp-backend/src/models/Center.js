const mongoose = require("mongoose");

const centerSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, "Center code is required"], unique: true, trim: true },
    name: { type: String, required: [true, "Center name is required"], trim: true },
    address: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    pinCode: { type: String, trim: true, match: [/^\d{6}$/, "Pin code must be 6 digits"] },
    email: { type: String, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid center email address"] },
    mobile: { type: String, trim: true, match: [/^[6-9]\d{9}$/, "Center mobile must be 10 digits and start with 6, 7, 8 or 9"] },
    qualification: { type: String, trim: true },
    instituteProperty: { type: String, trim: true }, // owned / rented etc., as entered
    currentOccupation: { type: String, trim: true },
    ownerFirstName: { type: String, trim: true },
    ownerLastName: { type: String, trim: true },
    ownerMobile: { type: String, trim: true, match: [/^[6-9]\d{9}$/, "Owner mobile must be 10 digits and start with 6, 7, 8 or 9"] },
    ownerEmail: { type: String, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid owner email address"] },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Center", centerSchema);
