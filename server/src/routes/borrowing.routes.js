const express = require("express");
const borrowing = require("../controllers/borrowingController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", borrowing.listBorrowings);
router.post("/", borrowing.borrowBook);
router.patch("/:id/return", borrowing.returnBook);

module.exports = router;
