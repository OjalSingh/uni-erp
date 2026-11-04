const mongoose = require("mongoose");

// A print template is a full-page background image uploaded by head office for one kind of document.
// session / course left empty = applies to every session / course. The most specific match wins when printing.
const KINDS = ["certificate", "statement", "admit-card", "id-card"];

const templateSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: KINDS, required: [true, "Choose the document type"] },
    name: { type: String, required: [true, "Give the template a name"], trim: true },
    session: { type: String, trim: true, default: "" },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    image: { type: String, required: true },
    // Fine alignment for this template, in millimetres
    dx: { type: Number, default: 0, min: -30, max: 30 },
    dy: { type: Number, default: 0, min: -30, max: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
templateSchema.index({ kind: 1, session: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Template", templateSchema);
module.exports.KINDS = KINDS;
