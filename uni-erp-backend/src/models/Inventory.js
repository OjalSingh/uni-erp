const mongoose = require("mongoose");

const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobile = /^[6-9]\d{9}$/;

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Supplier name is required"], trim: true },
    businessName: { type: String, required: [true, "Business name is required"], trim: true },
    mobile: { type: String, required: [true, "Mobile number is required"], trim: true, match: [mobile, "Mobile must be 10 digits and start with 6, 7, 8 or 9"] },
    email: { type: String, trim: true, lowercase: true, match: [email, "Enter a valid email address"] },
    pan: { type: String, trim: true, uppercase: true, match: [/^[A-Z]{5}\d{4}[A-Z]$/, "PAN must look like ABCDE1234F"] },
    gst: { type: String, trim: true, uppercase: true, match: [/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "Enter a valid 15-character GST number"] },
    address: { type: String, trim: true },
  },
  { timestamps: true }
);

const itemSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, "Item code is required"], unique: true, trim: true },
    name: { type: String, required: [true, "Item name is required"], trim: true },
  },
  { timestamps: true }
);

const stockEntrySchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    purchasePrice: { type: Number, required: true, min: [0, "Purchase price cannot be negative"] },
    sellPrice: { type: Number, required: true, min: [0, "Sell price cannot be negative"] },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    quantity: { type: Number, required: true, min: [1, "Quantity must be at least 1"], validate: { validator: Number.isInteger, message: "Quantity must be a whole number" } },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = {
  Supplier: mongoose.model("Supplier", supplierSchema),
  Item: mongoose.model("Item", itemSchema),
  StockEntry: mongoose.model("StockEntry", stockEntrySchema),
};
