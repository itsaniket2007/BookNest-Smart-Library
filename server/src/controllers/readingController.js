const { ReadingProgress, ReadingCompletion, Book } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { monthKey } = require("../utils/money");
const { getBusinessRules } = require("../services/jsonData");

function serialize(entry) {
  return {
    bookId: entry.book && entry.book._id ? String(entry.book._id) : String(entry.book),
    book: entry.book && entry.book.toPublicJSON ? entry.book.toPublicJSON() : null,
    status: entry.status,
    progress: entry.progress,
    currentPage: entry.currentPage,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    completedMonth: entry.completedMonth
  };
}

async function challengeFor(user) {
  const current = monthKey();
  // Migrate legacy completedMonth records on read so existing installations do
  // not lose challenge credit when upgrading to the immutable ledger.
  const legacy = await ReadingProgress.find({ user: user._id, completedMonth: current }).select("book completedAt");
  for (const entry of legacy) {
    await ReadingCompletion.updateOne(
      { user: user._id, book: entry.book, month: current },
      { $setOnInsert: { completedAt: entry.completedAt || entry.updatedAt || new Date() } },
      { upsert: true }
    );
  }
  const completed = await ReadingCompletion.countDocuments({ user: user._id, month: current });
  const target = user.monthlyReadingTarget || getBusinessRules().monthlyReadingTarget;
  const remaining = Math.max(0, target - completed);
  const percent = Math.min(100, Math.round((completed / target) * 100));
  return { month: current, completed: completed, remaining: remaining, target: target, percent: percent };
}

const listReading = asyncHandler(async function listReading(req, res) {
  const items = await ReadingProgress.find({ user: req.user._id }).populate("book").sort({ updatedAt: -1 });
  await Promise.all(items.filter(function (item) { return item.completedMonth; }).map(function (item) {
    return ReadingCompletion.updateOne(
      { user: req.user._id, book: item.book._id || item.book, month: item.completedMonth },
      { $setOnInsert: { completedAt: item.completedAt || item.updatedAt || new Date() } }, { upsert: true }
    );
  }));
  const completions = await ReadingCompletion.find({ user: req.user._id }).populate("book").sort({ completedAt: -1 });
  const history = completions.map(function (item) {
      return {
        bookId: String(item.book._id || item.book),
        title: item.book && item.book.title,
        completedAt: item.completedAt,
        completedMonth: item.month
      };
    });
  res.json({
    success: true,
    reading: items.map(serialize),
    history: history,
    challenge: await challengeFor(req.user)
  });
});

const addReading = asyncHandler(async function addReading(req, res) {
  const book = await Book.findById(req.body.bookId);
  if (!book) throw new AppError("That book is not in the catalogue.", 404);
  const existing = await ReadingProgress.findOne({ user: req.user._id, book: book._id });
  if (existing) throw new AppError("“" + book.title + "” is already in your reading list.", 409);
  const entry = await ReadingProgress.create({
    user: req.user._id,
    book: book._id,
    status: "Started",
    progress: 0,
    currentPage: 1,
    startedAt: new Date()
  });
  await entry.populate("book");
  res.status(201).json({
    success: true,
    message: "“" + book.title + "” added to your reading list as Started.",
    item: serialize(entry)
  });
});

const updateProgress = asyncHandler(async function updateProgress(req, res) {
  const book = await Book.findById(req.params.bookId);
  if (!book) throw new AppError("That book is not in the catalogue.", 404);
  const progress = Number(req.body.progress);
  const page = req.body.currentPage !== undefined ? Number(req.body.currentPage) : undefined;
  if (req.body.progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    throw new AppError("Enter a whole number from 0 to 100.", 400);
  }
  let entry = await ReadingProgress.findOne({ user: req.user._id, book: book._id });
  if (!entry) {
    entry = await ReadingProgress.create({
      user: req.user._id,
      book: book._id,
      status: "Started",
      progress: 0,
      startedAt: new Date()
    });
  }
  if (entry.status === "Completed" && req.body.restart !== true) {
    if (page && Number.isInteger(page) && page >= 1) {
      entry.currentPage = page;
      await entry.save();
      await entry.populate("book");
      return res.json({
        success: true,
        message: "Reading position saved.",
        item: serialize(entry),
        challenge: await challengeFor(req.user)
      });
    }
    throw new AppError("This book is already completed. Use “Read again” to restart it.", 409);
  }
  if (req.body.progress !== undefined && progress >= 100) return completeBookHandler(req, res, book, entry);
  if (req.body.progress !== undefined) {
    entry.progress = progress;
    entry.status = progress > 0 ? "In Progress" : "Started";
  }
  if (page && Number.isInteger(page) && page >= 1) entry.currentPage = page;
  if (req.body.restart === true) {
    entry.status = "Started";
    entry.progress = 0;
    entry.currentPage = 1;
    entry.completedAt = null;
    entry.startedAt = new Date();
  }
  await entry.save();
  await entry.populate("book");
  res.json({
    success: true,
    message: req.body.restart ? "“" + book.title + "” is back on your reading list." : "Reading progress saved (" + entry.progress + "%).",
    item: serialize(entry),
    challenge: await challengeFor(req.user)
  });
});

async function completeBookHandler(req, res, book, entry) {
  if (entry.status === "Completed") {
    throw new AppError("“" + book.title + "” is already marked as completed.", 409);
  }
  const now = new Date();
  entry.status = "Completed";
  entry.progress = 100;
  entry.completedAt = now;
  entry.completedMonth = monthKey(now);
  await entry.save();
  // A duplicate is deliberately harmless: a title is credited once per month.
  await ReadingCompletion.updateOne(
    { user: req.user._id, book: book._id, month: entry.completedMonth },
    { $setOnInsert: { completedAt: now } },
    { upsert: true }
  );
  await entry.populate("book");
  res.json({
    success: true,
    message: "“" + book.title + "” completed. Your monthly challenge has been updated.",
    item: serialize(entry),
    challenge: await challengeFor(req.user)
  });
}

const completeBook = asyncHandler(async function completeBook(req, res) {
  const book = await Book.findById(req.params.bookId);
  if (!book) throw new AppError("That book is not in the catalogue.", 404);
  let entry = await ReadingProgress.findOne({ user: req.user._id, book: book._id });
  if (!entry) {
    entry = await ReadingProgress.create({
      user: req.user._id,
      book: book._id,
      startedAt: new Date()
    });
  }
  return completeBookHandler(req, res, book, entry);
});

const restartBook = asyncHandler(async function restartBook(req, res) {
  req.body.restart = true;
  req.body.progress = 0;
  return updateProgress(req, res);
});

const getChallenge = asyncHandler(async function getChallenge(req, res) {
  const history = await ReadingCompletion.find({ user: req.user._id }).populate("book", "title").sort({ completedAt: -1 });
  res.json({
    success: true,
    challenge: await challengeFor(req.user),
    history: history.map(function (entry) {
      return { bookId: String(entry.book && entry.book._id || entry.book), title: entry.book && entry.book.title, completedAt: entry.completedAt, completedMonth: entry.month };
    })
  });
});

module.exports = { listReading, addReading, updateProgress, completeBook, restartBook, getChallenge };
