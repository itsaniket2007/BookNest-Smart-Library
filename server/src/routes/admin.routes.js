const express = require("express");
const books = require("../controllers/bookController");
const orders = require("../controllers/orderController");
const feedback = require("../controllers/feedbackController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { pdfUpload, coverUpload } = require("../middleware/upload");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", feedback.adminDashboard);
router.get("/users", feedback.adminUsers);
router.get("/feedback", feedback.adminList);
router.post("/orders/:id/refund", orders.refundRazorpayOrder);
router.post("/books", books.bookValidators, validate, books.createBook);
router.put("/books/:id", books.updateBookValidators, validate, books.updateBook);
router.delete("/books/:id", books.deleteBook);
router.post("/books/:id/cover", coverUpload(), books.uploadCover);
router.post("/books/:id/pdf", pdfUpload(), books.uploadPdf);
router.patch("/books/:id/pdf/authorize", books.authorizePdf);

module.exports = router;
