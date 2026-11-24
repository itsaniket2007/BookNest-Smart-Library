const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("../config/env");

let instance = null;

function getInstance() {
  if (instance) return instance;
  if (!isConfigured()) {
    console.warn("Razorpay credentials not configured. Payments will be simulated.");
    return null;
  }
  instance = new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret
  });
  return instance;
}

function isConfigured() {
  return Boolean(
    env.razorpayKeyId && env.razorpayKeySecret &&
    !env.razorpayKeyId.includes("xxxxxxxx") &&
    !env.razorpayKeySecret.startsWith("your_")
  );
}

async function createOrder(amountInPaise, receipt, notes) {
  const rzp = getInstance();
  if (!rzp) return null;
  return rzp.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: receipt,
    notes: notes || {}
  });
}

function verifySignature(orderId, paymentId, signature) {
  const body = orderId + "|" + paymentId;
  const expected = crypto.createHmac("sha256", env.razorpayKeySecret).update(body).digest("hex");
  return typeof signature === "string" && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function verifyWebhookSignature(body, signature) {
  if (!env.razorpayWebhookSecret) return false;
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex");
  return typeof signature === "string" && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function fetchPayment(paymentId) {
  const rzp = getInstance();
  if (!rzp) return null;
  return rzp.payments.fetch(paymentId);
}

async function refundPayment(paymentId, amountInPaise) {
  const rzp = getInstance();
  if (!rzp) return null;
  const options = {};
  if (amountInPaise) options.amount = amountInPaise;
  return rzp.payments.refund(paymentId, options);
}

module.exports = { getInstance, isConfigured, createOrder, verifySignature, verifyWebhookSignature, fetchPayment, refundPayment };
