const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../../.env") });

function requireInProduction(name) {
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(name + " must be set in production");
  }
}

requireInProduction("MONGODB_URI");
requireInProduction("JWT_SECRET");

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5000",
  adminEmail: (process.env.ADMIN_EMAIL || "admin@booknest.local").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "AdminPass123!",
  adminFirstName: process.env.ADMIN_FIRST_NAME || "BookNest",
  adminLastName: process.env.ADMIN_LAST_NAME || "Admin",
  cookieName: "booknest_token",

  // SMTP / Email
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  emailFrom: process.env.EMAIL_FROM || "BookNest <noreply@booknest.local>",

  // Razorpay
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ""
};
