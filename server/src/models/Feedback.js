const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Suggestion", "Problem", "Book Request", "Borrowing Support", "Other"],
      required: true
    },
    message: { type: String, required: true, minlength: 10, maxlength: 2000 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
