const express = require("express");
const rateLimit = require("express-rate-limit");
const auth = require("../controllers/authController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Keep a tighter limit around credential and one-time-token operations than
// the general API limiter.  Successful requests are still counted to avoid
// account enumeration and reset-email abuse.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again later." }
});
const sensitiveLimit = process.env.NODE_ENV === "test" ? function (req, res, next) { next(); } : credentialLimiter;

router.post("/register", sensitiveLimit, auth.registerValidators, validate, auth.register);
router.post("/login", sensitiveLimit, auth.loginValidators, validate, auth.login);
router.get("/me", requireAuth, auth.me);
router.post("/logout", auth.logout);
router.post("/verify-email", sensitiveLimit, auth.tokenValidator, validate, auth.verifyEmail);
router.post("/resend-verification", sensitiveLimit, requireAuth, auth.resendVerification);
router.post("/forgot-password", sensitiveLimit, auth.forgotPasswordValidators, validate, auth.forgotPassword);
router.post("/reset-password", sensitiveLimit, auth.resetPasswordValidators, validate, auth.resetPassword);
router.post("/change-password", sensitiveLimit, requireAuth, auth.changePasswordValidators, validate, auth.changePassword);

module.exports = router;
