const { Borrowing, Book } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { monthKey } = require("../utils/money");
const { getBusinessRules } = require("../services/jsonData");

function dueInfo(loan) {
  const days = Math.ceil((new Date(loan.dueAt) - new Date()) / 86400000);
  if (loan.returnedAt) return { text: "Returned", overdue: false, remainingDays: 0 };
  if (days < 0) return { text: Math.abs(days) + " day(s) overdue", overdue: true, remainingDays: days };
  if (days === 0) return { text: "Due today", overdue: false, remainingDays: 0 };
  return { text: days + " day(s) remaining", overdue: false, remainingDays: days };
}

function serialize(loan) {
  const book = loan.book && loan.book.toPublicJSON ? loan.book.toPublicJSON() : null;
  const info = dueInfo(loan);
  return {
    id: String(loan._id),
    bookId: book ? book.id : String(loan.book),
    book: book,
    borrowedAt: loan.borrowedAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    remainingDays: info.remainingDays,
    overdue: info.overdue,
    dueText: info.text
  };
}

const listBorrowings = asyncHandler(async function listBorrowings(req, res) {
  const rules = getBusinessRules();
  const loans = await Borrowing.find({ user: req.user._id }).populate("book").sort({ borrowedAt: -1 });
  const currentMonth = monthKey();
  const thisMonth = loans.filter(function (loan) {
    return monthKey(loan.borrowedAt) === currentMonth;
  }).length;
  res.json({
    success: true,
    limit: rules.maxBorrowingPerMonth,
    durationDays: rules.borrowingDurationDays,
    usedThisMonth: thisMonth,
    limitReached: thisMonth >= rules.maxBorrowingPerMonth,
    borrowings: loans.map(serialize)
  });
});

const borrowBook = asyncHandler(async function borrowBook(req, res) {
  const rules = getBusinessRules();
  const book = await Book.findById(req.body.bookId);
  if (!book) throw new AppError("That book is not in the catalogue.", 404);

  const active = await Borrowing.findOne({ user: req.user._id, book: book._id, returnedAt: null });
  if (active) throw new AppError("“" + book.title + "” is already borrowed and has not been returned.", 409);

  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const used = await Borrowing.countDocuments({
    user: req.user._id,
    borrowedAt: { $gte: start, $lt: end }
  });
  if (used >= rules.maxBorrowingPerMonth) {
    throw new AppError(
      "Monthly borrowing limit reached. You can borrow only " + rules.maxBorrowingPerMonth +
      " books per calendar month, even if you return one early.",
      409
    );
  }

  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + rules.borrowingDurationDays);
  const loan = await Borrowing.create({
    user: req.user._id,
    book: book._id,
    borrowedAt: now,
    dueAt: due,
    returnedAt: null
  });
  await loan.populate("book");
  res.status(201).json({
    success: true,
    message: "“" + book.title + "” borrowed. Due in " + rules.borrowingDurationDays + " days.",
    borrowing: serialize(loan)
  });
});

const returnBook = asyncHandler(async function returnBook(req, res) {
  const loan = await Borrowing.findOne({ _id: req.params.id, user: req.user._id }).populate("book");
  if (!loan) throw new AppError("Borrowing record not found.", 404);
  if (loan.returnedAt) throw new AppError("This book has already been returned.", 409);
  loan.returnedAt = new Date();
  await loan.save();
  res.json({
    success: true,
    message: "Book returned. It still counts towards this month's borrowing limit.",
    borrowing: serialize(loan)
  });
});

module.exports = { listBorrowings, borrowBook, returnBook };
