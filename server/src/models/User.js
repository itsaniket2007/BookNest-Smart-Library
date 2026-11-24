const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer", index: true },
    address: { type: String, default: "", maxlength: 300 },
    favoriteCategory: { type: String, default: "" },
    photoFilename: { type: String, default: "" },
    monthlyReadingTarget: { type: Number, default: 5, min: 1, max: 100 },
    isEmailVerified: { type: Boolean, default: false },
    // Store only hashes of one-time secrets. The raw value exists solely in
    // the verification/reset link sent to the account holder.
    emailVerificationToken: { type: String, default: "", select: false },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String, default: "", select: false },
    passwordResetExpires: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
