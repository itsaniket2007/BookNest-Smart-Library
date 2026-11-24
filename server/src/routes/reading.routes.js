const express = require("express");
const reading = require("../controllers/readingController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", reading.listReading);
router.get("/challenge", reading.getChallenge);
router.post("/", reading.addReading);
router.patch("/:bookId/progress", reading.updateProgress);
router.patch("/:bookId/complete", reading.completeBook);
router.patch("/:bookId/restart", reading.restartBook);

module.exports = router;
