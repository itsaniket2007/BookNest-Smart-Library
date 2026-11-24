const mongoose = require("mongoose");

// Immutable monthly completion ledger.  The compound unique index prevents a
// restarted title from inflating a customer's challenge more than once/month.
const readingCompletionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    completedAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

readingCompletionSchema.index({ user: 1, book: 1, month: 1 }, { unique: true });
readingCompletionSchema.index({ user: 1, month: 1 });

module.exports = mongoose.model("ReadingCompletion", readingCompletionSchema);
