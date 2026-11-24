const express = require("express");
const feedback = require("../controllers/feedbackController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.post("/", requireAuth, feedback.feedbackValidators, validate, feedback.createFeedback);
router.get("/mine", requireAuth, feedback.mine);

module.exports = router;
