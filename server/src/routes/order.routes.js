const express = require("express");
const orders = require("../controllers/orderController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.post("/checkout", orders.checkout);
router.post("/razorpay", orders.createRazorpayCheckout);
router.post("/:id/razorpay/verify", orders.verifyRazorpayPayment);
router.get("/", orders.listOrders);
router.get("/:id", orders.getOrder);

module.exports = router;
