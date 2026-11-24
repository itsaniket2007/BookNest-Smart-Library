const { body } = require("express-validator");
const { Feedback, User, Book, Order } = require("../models");
const asyncHandler = require("../utils/asyncHandler");

const feedbackValidators = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Enter your name (at least 2 characters)."),
  body("email").isEmail().withMessage("Enter a valid email address."),
  body("type").isIn(["Suggestion", "Problem", "Book Request", "Borrowing Support", "Other"]).withMessage("Choose a feedback type."),
  body("message").trim().isLength({ min: 10, max: 2000 }).withMessage("Write at least 10 characters so the message is useful.")
];

function serialize(item) {
  return {
    id: String(item._id),
    name: item.name,
    email: item.email,
    type: item.type,
    message: item.message,
    createdAt: item.createdAt
  };
}

const createFeedback = asyncHandler(async function createFeedback(req, res) {
  const item = await Feedback.create({
    user: req.user._id,
    name: req.body.name,
    email: req.body.email,
    type: req.body.type,
    message: req.body.message
  });
  res.status(201).json({
    success: true,
    message: "Thanks. Your feedback has been saved for the BookNest team.",
    feedback: serialize(item)
  });
});

const mine = asyncHandler(async function mine(req, res) {
  const items = await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, feedback: items.map(serialize) });
});

const adminList = asyncHandler(async function adminList(req, res) {
  const items = await Feedback.find().populate("user", "firstName lastName email").sort({ createdAt: -1 });
  res.json({
    success: true,
    feedback: items.map(function (item) {
      return Object.assign(serialize(item), {
        user: item.user ? { id: String(item.user._id), email: item.user.email, name: item.user.firstName + " " + item.user.lastName } : null
      });
    })
  });
});

const adminUsers = asyncHandler(async function adminUsers(req, res) {
  const users = await User.find().select("firstName lastName email role mobile createdAt").sort({ createdAt: -1 });
  res.json({
    success: true,
    users: users.map(function (user) {
      return {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        createdAt: user.createdAt
      };
    })
  });
});

const adminDashboard = asyncHandler(async function adminDashboard(req, res) {
  const [customers, books, feedback, orders, authorizedPdfs, pendingPdfs] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    Book.countDocuments(),
    Feedback.countDocuments(),
    Order.countDocuments(),
    Book.countDocuments({ pdfAuthorized: true, pdfFilename: { $ne: "" } }),
    Book.countDocuments({ pdfFilename: { $ne: "" }, pdfAuthorized: false })
  ]);
  res.json({ success: true, stats: { customers: customers, books: books, feedback: feedback, orders: orders, authorizedPdfs: authorizedPdfs, pendingPdfs: pendingPdfs } });
});

module.exports = { createFeedback, mine, adminList, adminUsers, adminDashboard, feedbackValidators };
