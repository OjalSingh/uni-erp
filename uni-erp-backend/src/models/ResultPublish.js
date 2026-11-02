const mongoose = require("mongoose");

const resultPublishSchema = new mongoose.Schema(
  {
    publishId: { type: Number, required: true, unique: true },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    comments: { type: String, trim: true },
    publishDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

resultPublishSchema.pre("validate", function () {
  if (this.endDate < this.publishDate) this.invalidate("endDate", "End date must be on or after the publish date");
});

module.exports = mongoose.model("ResultPublish", resultPublishSchema);
