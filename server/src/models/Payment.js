const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "authorized", "captured", "failed", "refunded"], default: "created" },
    method: { type: String, default: "" },
    refundId: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ["", "pending", "processed", "failed"], default: "" },
    refundedAt: { type: Date },
    webhookEvents: [{ eventId: { type: String, default: "" }, event: String, payload: mongoose.Schema.Types.Mixed, receivedAt: { type: Date, default: Date.now } }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
