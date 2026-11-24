const express = require("express");
const rateLimit = require("express-rate-limit");
const razorpayService = require("../services/razorpayService");
const { Payment, Order } = require("../models");
const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many webhook requests." }
});

router.post("/razorpay", webhookLimiter, express.raw({ type: "application/json", limit: "1mb" }), async function (req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, message: "Raw webhook body required" });
    const body = req.body.toString("utf8");

    if (!razorpayService.verifyWebhookSignature(body, signature)) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const payload = event.payload;
    const eventId = String(req.headers["x-razorpay-event-id"] || "");

    function recordEvent(payment, entity) {
      if (!eventId || !payment.webhookEvents.some(function (item) { return item.eventId === eventId; })) {
        payment.webhookEvents.push({ eventId: eventId, event: eventType, payload: entity, receivedAt: new Date() });
        return true;
      }
      return false;
    }

    if (eventType === "payment.captured" && payload.payment && payload.payment.entity) {
      const paymentEntity = payload.payment.entity;
      const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
      if (payment) {
        payment.razorpayPaymentId = paymentEntity.id;
        payment.status = "captured";
        payment.method = paymentEntity.method || "";
        recordEvent(payment, paymentEntity);
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order && order.status === "placed") {
          order.status = "confirmed";
          order.paymentNote = "Payment confirmed via webhook. Payment ID: " + paymentEntity.id;
          await order.save();
        }
      }
    }

    if (eventType === "payment.failed" && payload.payment && payload.payment.entity) {
      const paymentEntity = payload.payment.entity;
      const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
      if (payment) {
        payment.status = "failed";
        recordEvent(payment, paymentEntity);
        await payment.save();
      }
    }

    if (eventType === "refund.processed" && payload.refund && payload.refund.entity) {
      const refundEntity = payload.refund.entity;
      const payment = await Payment.findOne({ razorpayPaymentId: refundEntity.payment_id });
      if (payment) {
        payment.refundId = refundEntity.id;
        payment.refundAmount = refundEntity.amount / 100;
        payment.refundStatus = "processed";
        payment.refundedAt = new Date();
        payment.status = "refunded";
        recordEvent(payment, refundEntity);
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order) {
          order.status = "refunded";
          order.paymentNote = "Refund processed. Refund ID: " + refundEntity.id;
          await order.save();
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
