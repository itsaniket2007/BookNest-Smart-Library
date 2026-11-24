const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const { User } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { publicUser } = require("../utils/money");
const { getBusinessRules } = require("../services/jsonData");
const { signToken, setAuthCookie, clearAuthCookie } = require("../middleware/auth");
const emailService = require("../services/emailService");

const passwordRule = body("password")
  .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
  .matches(/[A-Za-z]/).withMessage("Password must include a letter.")
  .matches(/\d/).withMessage("Password must include a number.");

const registerValidators = [
  body("firstName").trim().isLength({ min: 2, max: 60 }).withMessage("Enter your first name (at least 2 characters)."),
  body("lastName").trim().isLength({ min: 1, max: 60 }).withMessage("Enter your last name."),
  body("email").isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("mobile").optional({ values: "falsy" }).matches(/^\d{10}$/).withMessage("Enter a 10-digit mobile number."),
  passwordRule,
  body("confirmPassword").custom(function (value, meta) {
    if (value !== meta.req.body.password) throw new Error("Passwords do not match.");
    return true;
  })
];

const loginValidators = [
  body("email").isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("password").notEmpty().withMessage("Enter your password.")
];

const emailValidator = body("email").isEmail().withMessage("Enter a valid email address.").normalizeEmail();
const tokenValidator = body("token").isString().isLength({ min: 32, max: 256 }).withMessage("Invalid token.");
const newPasswordValidator = body("newPassword")
  .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
  .matches(/[A-Za-z]/).withMessage("Password must include a letter.")
  .matches(/\d/).withMessage("Password must include a number.");
const forgotPasswordValidators = [emailValidator];
const resetPasswordValidators = [tokenValidator, newPasswordValidator];
const changePasswordValidators = [
  body("currentPassword").isString().notEmpty().withMessage("Current password is required."),
  newPasswordValidator
];

function makeToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw: raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function issueAuth(res, user) {
  const token = signToken(user._id);
  setAuthCookie(res, token);
  return { token: token, user: publicUser(user) };
}

const register = asyncHandler(async function register(req, res) {
  const email = String(req.body.email).toLowerCase();
  const exists = await User.findOne({ email: email });
  if (exists) throw new AppError("An account with this email already exists.", 409);
  const rules = getBusinessRules();
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const verificationToken = makeToken();
  const user = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: email,
    mobile: req.body.mobile || "",
    passwordHash: passwordHash,
    role: "customer",
    monthlyReadingTarget: rules.monthlyReadingTarget,
    emailVerificationToken: verificationToken.hash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken.raw);
  const auth = issueAuth(res, user);
  res.status(201).json({ success: true, message: "Account created. Please check your email to verify your address.", token: auth.token, user: auth.user, emailVerified: false });
});

const login = asyncHandler(async function login(req, res) {
  const email = String(req.body.email).toLowerCase();
  const user = await User.findOne({ email: email }).select("+passwordHash");
  if (!user) throw new AppError("Incorrect email or password.", 401);
  const match = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!match) throw new AppError("Incorrect email or password.", 401);
  const auth = issueAuth(res, user);
  res.json({ success: true, message: "Logged in.", token: auth.token, user: auth.user });
});

const me = asyncHandler(async function me(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
});

const logout = asyncHandler(async function logout(req, res) {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out." });
});

const verifyEmail = asyncHandler(async function verifyEmail(req, res) {
  const token = req.query.token || req.body.token;
  if (!token) throw new AppError("Verification token is required.", 400);
  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: Date.now() }
  });
  if (!user) throw new AppError("Invalid or expired verification token.", 400);
  user.isEmailVerified = true;
  user.emailVerificationToken = "";
  user.emailVerificationExpires = undefined;
  await user.save();
  res.json({ success: true, message: "Email verified successfully." });
});

const resendVerification = asyncHandler(async function resendVerification(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("Account not found.", 404);
  if (user.isEmailVerified) throw new AppError("Email is already verified.", 400);
  const token = makeToken();
  user.emailVerificationToken = token.hash;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  await emailService.sendVerificationEmail(user.email, user.firstName, token.raw);
  res.json({ success: true, message: "Verification email sent. Please check your inbox." });
});

const forgotPassword = asyncHandler(async function forgotPassword(req, res) {
  const email = String(req.body.email || "").toLowerCase();
  if (!email) throw new AppError("Email is required.", 400);
  const user = await User.findOne({ email: email });
  if (user) {
    const resetToken = makeToken();
    user.passwordResetToken = resetToken.hash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken.raw);
  }
  res.json({ success: true, message: "If that email exists, we sent a reset link." });
});

const resetPassword = asyncHandler(async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token) throw new AppError("Reset token is required.", 400);
  if (!newPassword) throw new AppError("New password is required.", 400);
  if (newPassword.length < 8) throw new AppError("Password must be at least 8 characters.", 400);
  if (!/[A-Za-z]/.test(newPassword)) throw new AppError("Password must include a letter.", 400);
  if (!/\d/.test(newPassword)) throw new AppError("Password must include a number.", 400);
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: Date.now() }
  });
  if (!user) throw new AppError("Invalid or expired reset token.", 400);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = "";
  user.passwordResetExpires = undefined;
  await user.save();
  res.json({ success: true, message: "Password has been reset successfully." });
});

const changePassword = asyncHandler(async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError("Current password and new password are required.", 400);
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user) throw new AppError("Account not found.", 404);
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw new AppError("Current password is incorrect.", 401);
  if (newPassword.length < 8) throw new AppError("Password must be at least 8 characters.", 400);
  if (!/[A-Za-z]/.test(newPassword)) throw new AppError("Password must include a letter.", 400);
  if (!/\d/.test(newPassword)) throw new AppError("Password must include a number.", 400);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true, message: "Password changed successfully." });
});

module.exports = {
  register, login, me, logout, registerValidators, loginValidators,
  verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword,
  tokenValidator, forgotPasswordValidators, resetPasswordValidators, changePasswordValidators
};
