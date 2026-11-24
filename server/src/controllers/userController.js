const path = require("path");
const fs = require("fs");
const { body } = require("express-validator");
const { User, Cart, Wishlist, Borrowing, ReadingProgress, Order, Feedback } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { publicUser } = require("../utils/money");
const { uploadRoot, requireFileSignature } = require("../middleware/upload");

const updateValidators = [
  body("firstName").optional().trim().isLength({ min: 2, max: 60 }).withMessage("Enter your first name (at least 2 characters)."),
  body("lastName").optional().trim().isLength({ min: 1, max: 60 }).withMessage("Enter your last name."),
  body("mobile").optional({ values: "falsy" }).matches(/^\d{10}$/).withMessage("Enter a 10-digit mobile number, or leave it empty."),
  body("address").optional().isLength({ max: 300 }).withMessage("Address is too long."),
  body("category").optional().isLength({ max: 80 }),
  body("monthlyReadingTarget").optional().isInt({ min: 1, max: 100 }).withMessage("Enter a whole number from 1 to 100.")
];

const getMe = asyncHandler(async function getMe(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
});

const dashboard = asyncHandler(async function dashboard(req, res) {
  const user = req.user._id;
  const [cart, wishlist, activeBorrowings, reading, orders, feedback] = await Promise.all([
    Cart.findOne({ user: user }), Wishlist.findOne({ user: user }),
    Borrowing.countDocuments({ user: user, returnedAt: null }),
    ReadingProgress.countDocuments({ user: user }), Order.countDocuments({ user: user }), Feedback.countDocuments({ user: user })
  ]);
  res.json({ success: true, dashboard: {
    cartItems: cart ? cart.items.reduce(function (sum, item) { return sum + item.quantity; }, 0) : 0,
    wishlistItems: wishlist ? wishlist.books.length : 0, activeBorrowings: activeBorrowings,
    readingListItems: reading, orders: orders, feedback: feedback
  } });
});

const updateMe = asyncHandler(async function updateMe(req, res) {
  const user = await User.findById(req.user._id);
  if (req.body.firstName) user.firstName = req.body.firstName;
  if (req.body.lastName) user.lastName = req.body.lastName;
  if (req.body.mobile !== undefined) user.mobile = req.body.mobile || "";
  if (req.body.address !== undefined) user.address = req.body.address || "";
  if (req.body.category !== undefined) user.favoriteCategory = req.body.category || "";
  if (req.body.monthlyReadingTarget) user.monthlyReadingTarget = Number(req.body.monthlyReadingTarget);
  await user.save();
  res.json({ success: true, message: "Profile saved.", user: publicUser(user) });
});

const uploadPhoto = asyncHandler(async function uploadPhoto(req, res) {
  if (!req.file) throw new AppError("Choose an image file.", 400);
  requireFileSignature(req.file, "image");
  const user = await User.findById(req.user._id);
  if (user.photoFilename) {
    const previous = path.join(uploadRoot, "profiles", user.photoFilename);
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  user.photoFilename = req.file.filename;
  await user.save();
  res.json({ success: true, message: "Profile photo saved.", user: publicUser(user) });
});

const removePhoto = asyncHandler(async function removePhoto(req, res) {
  const user = await User.findById(req.user._id);
  if (user.photoFilename) {
    const previous = path.join(uploadRoot, "profiles", user.photoFilename);
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  user.photoFilename = "";
  await user.save();
  res.json({ success: true, message: "Profile photo removed.", user: publicUser(user) });
});

const photoFile = asyncHandler(async function photoFile(req, res) {
  if (!req.user.photoFilename) throw new AppError("No profile photo.", 404);
  const filePath = path.join(uploadRoot, "profiles", req.user.photoFilename);
  if (!fs.existsSync(filePath)) throw new AppError("Photo file missing.", 404);
  res.sendFile(filePath);
});

module.exports = { getMe, dashboard, updateMe, uploadPhoto, removePhoto, photoFile, updateValidators };
