const { Order, Book, Payment } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const cartService = require("../services/cartService");
const { getBusinessRules } = require("../services/jsonData");
const razorpayService = require("../services/razorpayService");
const env = require("../config/env");

function makeOrderId() {
  const now = new Date();
  const stamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return "BOOKNEST-" + stamp + "-" + rand;
}

function serialize(order) {
  return {
    id: String(order._id),
    orderId: order.orderId,
    items: order.items,
    subtotal: order.subtotal,
    gst: order.gst,
    total: order.total,
    gstPercentage: order.gstPercentage,
    paymentMethod: order.paymentMethod,
    status: order.status,
    paymentNote: order.paymentNote,
    razorpayOrderId: order.razorpayOrderId || "",
    paymentStatus: order.payment && order.payment.status ? order.payment.status : undefined,
    createdAt: order.createdAt
  };
}

async function checkoutLines(userId) {
  const summary = await cartService.summarizeCart(userId);
  if (!summary.items.length) throw new AppError("Your cart is empty.", 400);
  const items = [];
  for (const line of summary.items) {
    const book = await Book.findById(line.bookId);
    if (!book) throw new AppError("A book in your cart is no longer available.", 400);
    items.push({ book: book._id, title: book.title, author: book.author, unitPrice: book.price, quantity: line.quantity });
  }
  return { summary: summary, items: items, rules: getBusinessRules() };
}

const checkout = asyncHandler(async function checkout(req, res) {
  const method = req.body.paymentMethod;
  if (!["UPI", "Card", "Cash on Delivery"].includes(method)) {
    throw new AppError("Choose UPI, Card or Cash on Delivery.", 400);
  }
  if (req.body.cardNumber || req.body.cvv) {
    throw new AppError("Do not send card numbers or CVVs. This is a simulated checkout.", 400);
  }
  const prepared = await checkoutLines(req.user._id);
  const order = await Order.create({
    orderId: makeOrderId(),
    user: req.user._id,
    items: prepared.items,
    subtotal: prepared.summary.subtotal,
    gst: prepared.summary.gst,
    total: prepared.summary.total,
    gstPercentage: prepared.rules.gstPercentage,
    paymentMethod: method,
    status: "placed",
    paymentNote: "Simulated " + method + " payment. No real money was collected."
  });
  await cartService.clearCart(req.user._id);
  res.status(201).json({
    success: true,
    message: "Order placed using " + method + ". This is a demo order; no real payment was processed.",
    order: serialize(order)
  });
});

// Creates a Razorpay order but deliberately leaves the cart intact until the
// signed payment callback has been verified.
const createRazorpayCheckout = asyncHandler(async function createRazorpayCheckout(req, res) {
  if (!razorpayService.isConfigured()) {
    throw new AppError("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env, or use demo checkout.", 503);
  }
  const prepared = await checkoutLines(req.user._id);
  const orderId = makeOrderId();
  const amountInPaise = Math.round(prepared.summary.total * 100);
  const gatewayOrder = await razorpayService.createOrder(amountInPaise, orderId, {
    booknestOrderId: orderId,
    userId: String(req.user._id)
  });
  if (!gatewayOrder || !gatewayOrder.id) throw new AppError("Could not create the Razorpay order. Please try again.", 502);
  const order = await Order.create({
    orderId: orderId, user: req.user._id, items: prepared.items,
    subtotal: prepared.summary.subtotal, gst: prepared.summary.gst, total: prepared.summary.total,
    gstPercentage: prepared.rules.gstPercentage, paymentMethod: "Razorpay", status: "placed",
    razorpayOrderId: gatewayOrder.id, paymentNote: "Awaiting Razorpay payment confirmation."
  });
  const payment = await Payment.create({
    order: order._id, user: req.user._id, razorpayOrderId: gatewayOrder.id,
    amount: prepared.summary.total, currency: gatewayOrder.currency || "INR", status: "created"
  });
  order.payment = payment._id;
  await order.save();
  res.status(201).json({ success: true, message: "Razorpay checkout created. Complete payment in the Razorpay checkout window.", order: serialize(order), razorpay: {
    keyId: env.razorpayKeyId, orderId: gatewayOrder.id, amount: gatewayOrder.amount,
    currency: gatewayOrder.currency || "INR", name: "BookNest", description: "BookNest order " + order.orderId
  } });
});

const verifyRazorpayPayment = asyncHandler(async function verifyRazorpayPayment(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate("payment");
  if (!order || order.paymentMethod !== "Razorpay" || !order.payment) throw new AppError("Razorpay order not found.", 404);
  if (order.payment.status === "captured") return res.json({ success: true, message: "Payment was already verified.", order: serialize(order) });
  const paymentId = String(req.body.razorpay_payment_id || "");
  const signature = String(req.body.razorpay_signature || "");
  const gatewayOrderId = String(req.body.razorpay_order_id || "");
  if (!paymentId || !signature || gatewayOrderId !== order.razorpayOrderId || !razorpayService.verifySignature(gatewayOrderId, paymentId, signature)) {
    throw new AppError("Razorpay payment verification failed.", 400);
  }
  const gatewayPayment = await razorpayService.fetchPayment(paymentId);
  if (!gatewayPayment || gatewayPayment.order_id !== order.razorpayOrderId || Number(gatewayPayment.amount) !== Math.round(order.total * 100)) {
    throw new AppError("Razorpay payment details did not match this order.", 400);
  }
  if (!["authorized", "captured"].includes(gatewayPayment.status)) throw new AppError("Razorpay has not authorized this payment.", 409);
  order.payment.razorpayPaymentId = paymentId;
  order.payment.razorpaySignature = signature;
  order.payment.status = gatewayPayment.status;
  order.payment.method = gatewayPayment.method || "";
  await order.payment.save();
  order.status = "confirmed";
  order.paymentNote = "Razorpay payment verified. Payment ID: " + paymentId;
  await order.save();
  await cartService.clearCart(req.user._id);
  res.json({ success: true, message: "Razorpay payment verified. Your order is confirmed.", order: serialize(order) });
});

const refundRazorpayOrder = asyncHandler(async function refundRazorpayOrder(req, res) {
  const order = await Order.findById(req.params.id).populate("payment");
  if (!order || order.paymentMethod !== "Razorpay" || !order.payment) throw new AppError("Razorpay order not found.", 404);
  const payment = order.payment;
  if (!payment.razorpayPaymentId || !["authorized", "captured"].includes(payment.status)) throw new AppError("Only a confirmed Razorpay payment can be refunded.", 409);
  if (payment.refundStatus === "pending" || payment.refundStatus === "processed") throw new AppError("A refund is already in progress for this payment.", 409);
  const requested = req.body.amount === undefined || req.body.amount === "" ? payment.amount : Number(req.body.amount);
  if (!Number.isFinite(requested) || requested <= 0 || requested > payment.amount) throw new AppError("Refund amount must be greater than zero and no more than the payment total.", 400);
  const refund = await razorpayService.refundPayment(payment.razorpayPaymentId, Math.round(requested * 100));
  if (!refund || !refund.id) throw new AppError("Razorpay could not create the refund.", 502);
  payment.refundId = refund.id;
  payment.refundAmount = requested;
  payment.refundStatus = refund.status === "processed" ? "processed" : "pending";
  if (payment.refundStatus === "processed") { payment.status = "refunded"; payment.refundedAt = new Date(); order.status = "refunded"; }
  order.paymentNote = "Razorpay refund " + payment.refundStatus + ". Refund ID: " + refund.id;
  await payment.save();
  await order.save();
  res.json({ success: true, message: "Refund " + payment.refundStatus + ".", order: serialize(order), payment: { id: String(payment._id), refundId: payment.refundId, refundStatus: payment.refundStatus } });
});

const listOrders = asyncHandler(async function listOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).populate("payment").sort({ createdAt: -1 });
  res.json({ success: true, orders: orders.map(serialize) });
});

const getOrder = asyncHandler(async function getOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate("payment");
  if (!order) throw new AppError("Order not found.", 404);
  res.json({ success: true, order: serialize(order) });
});

module.exports = { checkout, createRazorpayCheckout, verifyRazorpayPayment, refundRazorpayOrder, listOrders, getOrder };
