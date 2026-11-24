const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.nodeEnv === "test" || !env.smtpHost || !env.smtpUser || !env.smtpPass || env.smtpUser.includes("your_email@") || env.smtpPass.includes("your_app_password")) {
    console.warn("SMTP not configured. Emails will be logged to console.");
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass }
  });
  return transporter;
}

async function sendMail(to, subject, html) {
  const transport = getTransporter();
  if (!transport) {
    console.log("--- EMAIL (not sent, SMTP not configured) ---");
    console.log("To:", to, "| Subject:", subject);
    console.log(html);
    console.log("--- END EMAIL ---");
    return { messageId: "console-" + Date.now(), consoleFallback: true };
  }
  const info = await transport.sendMail({
    from: env.emailFrom,
    to: to,
    subject: subject,
    html: html
  });
  return info;
}

async function sendVerificationEmail(email, firstName, token) {
  const link = env.clientOrigin + "/verify-email.html?token=" + token;
  const html = "<h2>Welcome to BookNest, " + firstName + "!</h2>" +
    "<p>Please verify your email address by clicking the link below:</p>" +
    '<p><a href="' + link + '" style="background:#6849e8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Verify Email</a></p>' +
    "<p>Or copy this link: " + link + "</p>" +
    "<p>This link expires in 24 hours.</p>" +
    "<p>If you didn't create a BookNest account, please ignore this email.</p>";
  return sendMail(email, "Verify your BookNest email", html);
}

async function sendPasswordResetEmail(email, firstName, token) {
  const link = env.clientOrigin + "/reset-password.html?token=" + token;
  const html = "<h2>Password Reset</h2>" +
    "<p>Hi " + firstName + ", we received a request to reset your BookNest password.</p>" +
    '<p><a href="' + link + '" style="background:#6849e8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Reset Password</a></p>' +
    "<p>Or copy this link: " + link + "</p>" +
    "<p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>";
  return sendMail(email, "Reset your BookNest password", html);
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
