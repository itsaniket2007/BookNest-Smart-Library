const mongoose = require("mongoose");

const borrowingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    borrowedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    returnedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

borrowingSchema.index({ user: 1, borrowedAt: -1 });
borrowingSchema.index({ user: 1, book: 1, returnedAt: 1 });

module.exports = mongoose.model("Borrowing", borrowingSchema);
