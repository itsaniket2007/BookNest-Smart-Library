const path = require("path");
const fs = require("fs");
const { body } = require("express-validator");
const { Book, Category } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getBusinessRules, getSiteContent, getCategoriesJson } = require("../services/jsonData");
const { canReadPdf } = require("../services/entitlementService");
const { uploadRoot, requireFileSignature } = require("../middleware/upload");

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapedRegex(value) {
  return new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

const bookValidators = [
  body("title").trim().isLength({ min: 1, max: 200 }).withMessage("Enter a book title."),
  body("author").trim().isLength({ min: 1, max: 200 }).withMessage("Enter an author."),
  body("category").trim().isLength({ min: 1 }).withMessage("Enter a category."),
  body("price").isFloat({ min: 0 }).withMessage("Enter a valid price."),
  body("description").trim().isLength({ min: 10 }).withMessage("Enter a description.")
];

const updateBookValidators = [
  body("title").optional().trim().isLength({ min: 1, max: 200 }),
  body("author").optional().trim().isLength({ min: 1, max: 200 }),
  body("category").optional().trim().isLength({ min: 1, max: 100 }),
  body("price").optional().isFloat({ min: 0 }),
  body("year").optional({ values: "falsy" }).isInt({ min: 1000, max: 2100 }),
  body("description").optional().trim().isLength({ min: 10, max: 5000 }),
  body("availability").optional().isIn(["in-stock", "unavailable"])
];

const listBooks = asyncHandler(async function listBooks(req, res) {
  const query = {};
  const search = String(req.query.search || req.query.q || "").trim();
  const author = String(req.query.author || "").trim();
  const category = String(req.query.category || "").trim();
  const sortKey = String(req.query.sort || "title");

  if (search.length > 100 || author.length > 100 || category.length > 100) {
    throw new AppError("Search filters must be 100 characters or fewer.", 400);
  }
  if (search) {
    query.$or = [
      { title: escapedRegex(search) },
      { author: escapedRegex(search) },
      { category: escapedRegex(search) }
    ];
  }
  if (author) query.author = escapedRegex(author);
  if (category && category !== "All") {
    if (category === "Data and Technology") query.category = { $in: ["Data Science", "Programming"] };
    else query.category = escapedRegex(category);
  }

  const sortMap = {
    title: { title: 1 },
    "title-desc": { title: -1 },
    price: { price: 1 },
    "price-desc": { price: -1 },
    year: { year: -1 }
  };
  const requestedPage = Number(req.query.page || 1);
  const requestedLimit = Number(req.query.limit || 0);
  if (!Number.isInteger(requestedPage) || requestedPage < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 0 || requestedLimit > 100) {
    throw new AppError("Pagination must use a positive page and a limit from 1 to 100.", 400);
  }
  const total = await Book.countDocuments(query);
  const queryBuilder = Book.find(query).sort(sortMap[sortKey] || { title: 1 });
  const books = requestedLimit ? await queryBuilder.skip((requestedPage - 1) * requestedLimit).limit(requestedLimit) : await queryBuilder;
  res.json({
    success: true,
    books: books.map(function (book) { return book.toPublicJSON(); }),
    page: requestedLimit ? requestedPage : 1,
    limit: requestedLimit || total,
    total: total,
    totalPages: requestedLimit ? Math.max(1, Math.ceil(total / requestedLimit)) : 1
  });
});

const getBook = asyncHandler(async function getBook(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  res.json({ success: true, book: book.toPublicJSON() });
});

const listContent = asyncHandler(async function listContent(req, res) {
  const categories = await Category.find().sort({ name: 1 });
  res.json({
    success: true,
    rules: getBusinessRules(),
    site: getSiteContent(),
    categories: categories.length ? categories : getCategoriesJson()
  });
});

const createBook = asyncHandler(async function createBook(req, res) {
  const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.title);
  const exists = await Book.findOne({ slug: slug });
  if (exists) throw new AppError("A book with this slug already exists.", 409);
  const book = await Book.create({
    slug: slug,
    title: req.body.title,
    author: req.body.author,
    category: req.body.category,
    price: Number(req.body.price),
    year: req.body.year ? Number(req.body.year) : null,
    cover: req.body.cover || "cover-purple",
    description: req.body.description,
    availability: req.body.availability || "in-stock",
    pdfAuthorized: false,
    pdfAvailable: false
  });
  res.status(201).json({ success: true, book: book.toPublicJSON() });
});

const updateBook = asyncHandler(async function updateBook(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  ["title", "author", "category", "description", "cover", "availability"].forEach(function (field) {
    if (req.body[field] !== undefined) book[field] = req.body[field];
  });
  if (req.body.price !== undefined) book.price = Number(req.body.price);
  if (req.body.year !== undefined) book.year = req.body.year === "" ? null : Number(req.body.year);
  await book.save();
  res.json({ success: true, message: "Book updated.", book: book.toPublicJSON() });
});

const deleteBook = asyncHandler(async function deleteBook(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  await book.deleteOne();
  res.json({ success: true, message: "Book deleted." });
});

const uploadCover = asyncHandler(async function uploadCover(req, res) {
  if (!req.file) throw new AppError("Choose a cover image.", 400);
  requireFileSignature(req.file, "image");
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  const previousFilename = book.coverImageFilename;
  book.coverImageFilename = req.file.filename;
  book.coverImageOriginalName = path.basename(req.file.originalname);
  await book.save();
  if (previousFilename && previousFilename !== req.file.filename) {
    const previous = path.join(uploadRoot, "covers", path.basename(previousFilename));
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  res.json({ success: true, message: "Cover uploaded.", book: book.toPublicJSON() });
});

const coverFile = asyncHandler(async function coverFile(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book || !book.coverImageFilename) throw new AppError("Cover not found.", 404);
  const filePath = path.join(uploadRoot, "covers", book.coverImageFilename);
  if (!fs.existsSync(filePath)) throw new AppError("Cover file missing.", 404);
  res.setHeader("Cache-Control", "private, no-cache, max-age=0");
  res.sendFile(filePath);
});

const uploadPdf = asyncHandler(async function uploadPdf(req, res) {
  if (!req.file) throw new AppError("Choose a PDF file.", 400);
  requireFileSignature(req.file, "pdf");
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  if (book.pdfFilename) {
    const previous = path.join(uploadRoot, "pdfs", book.pdfFilename);
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  book.pdfFilename = req.file.filename;
  book.pdfOriginalName = req.file.originalname;
  const authorized = String(req.body.authorizedForDistribution) === "true";
  book.pdfAuthorized = authorized;
  book.pdfAvailable = authorized;
  book.pdfAuthorizedAt = authorized ? new Date() : null;
  book.pdfAuthorizedBy = authorized ? req.user._id : null;
  await book.save();
  res.json({
    success: true,
    message: authorized
      ? "PDF stored and marked as authorized for customer reading."
      : "PDF stored, but customers cannot read it until you confirm distribution rights.",
    book: book.toPublicJSON()
  });
});

const authorizePdf = asyncHandler(async function authorizePdf(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  if (!book.pdfFilename) throw new AppError("Upload a PDF before authorizing it.", 400);
  const authorized = String(req.body.authorizedForDistribution) !== "false";
  book.pdfAuthorized = authorized;
  book.pdfAvailable = authorized;
  book.pdfAuthorizedAt = authorized ? new Date() : null;
  book.pdfAuthorizedBy = authorized ? req.user._id : null;
  await book.save();
  res.json({ success: true, book: book.toPublicJSON() });
});

const readPdf = asyncHandler(async function readPdf(req, res) {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError("Book not found.", 404);
  const access = await canReadPdf(req.user, book);
  if (!access.ok) throw new AppError(access.message, 403);
  if (!book.pdfFilename || book.pdfFilename.includes("..")) throw new AppError("PDF file missing.", 404);
  const resolved = book.pdfFilename.startsWith("samples/")
    ? path.join(uploadRoot, book.pdfFilename)
    : path.join(uploadRoot, "pdfs", path.basename(book.pdfFilename));
  if (!fs.existsSync(resolved)) throw new AppError("PDF file missing.", 404);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"" + (book.pdfOriginalName || "book.pdf") + "\"");
  res.sendFile(resolved);
});

module.exports = {
  listBooks,
  getBook,
  listContent,
  createBook,
  updateBook,
  deleteBook,
  uploadCover,
  coverFile,
  uploadPdf,
  authorizePdf,
  readPdf,
  bookValidators,
  updateBookValidators
};
