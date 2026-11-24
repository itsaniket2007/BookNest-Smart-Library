const mongoose = require("mongoose");

const STATUS = ["Started", "In Progress", "Completed"];

const readingProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    status: { type: String, enum: STATUS, default: "Started" },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    currentPage: { type: Number, min: 1, default: 1 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    completedMonth: { type: String, default: "" }
  },
  { timestamps: true }
);

readingProgressSchema.index({ user: 1, book: 1 }, { unique: true });
readingProgressSchema.index({ user: 1, completedMonth: 1 });

readingProgressSchema.statics.STATUS = STATUS;

module.exports = mongoose.model("ReadingProgress", readingProgressSchema);
