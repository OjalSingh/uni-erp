const mongoose = require("mongoose");

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: [true, "Each line needs a description"], trim: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" }, // set when the line draws from stock
    quantity: { type: Number, required: true, min: [1, "Quantity must be at least 1"], validate: { validator: Number.isInteger, message: "Quantity must be a whole number" } },
    price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: [0.01, "Payment must be more than zero"] },
  mode: { type: String, enum: ["Cash", "Cheque", "Bank transfer", "UPI", "Other"], required: true },
  paidAt: { type: Date, default: Date.now },
  reference: { type: String, trim: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: Number, required: true, unique: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, default: Date.now },
    lines: { type: [lineSchema], validate: { validator: (v) => v.length > 0, message: "Add at least one line" } },
    subTotal: { type: Number, required: true },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, required: true },
    discount: { type: Number, min: [0, "Discount cannot be negative"], default: 0 },
    grandTotal: { type: Number, required: true },
    payments: [paymentSchema],
  },
  { timestamps: true }
);

invoiceSchema.virtual("paid").get(function () {
  return Math.round(this.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
});
invoiceSchema.virtual("outstanding").get(function () {
  return Math.round((this.grandTotal - this.paid) * 100) / 100;
});
invoiceSchema.virtual("payoutStatus").get(function () {
  if (this.paid <= 0) return "Unpaid";
  return this.outstanding > 0 ? "Partially paid" : "Paid";
});
invoiceSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
