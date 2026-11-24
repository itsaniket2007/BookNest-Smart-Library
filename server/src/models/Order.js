const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    title: String,
    author: String,
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    gst: { type: Number, required: true },
    total: { type: Number, required: true },
    gstPercentage: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["UPI", "Card", "Cash on Delivery", "Razorpay"], required: true },
    status: { type: String, enum: ["placed", "confirmed", "completed", "cancelled", "refunded"], default: "placed" },
    paymentNote: { type: String, default: "Simulated payment. No real money was collected." },
    razorpayOrderId: { type: String, default: "" },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
