const express = require("express");
const books = require("../controllers/bookController");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", books.listBooks);
router.get("/content", books.listContent);
router.get("/:id/cover", books.coverFile);
router.get("/:id/pdf", optionalAuth, books.readPdf);
router.get("/:id", books.getBook);

module.exports = router;
