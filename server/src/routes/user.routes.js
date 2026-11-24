const express = require("express");
const users = require("../controllers/userController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { photoUpload } = require("../middleware/upload");

const router = express.Router();

router.get("/me", requireAuth, users.getMe);
router.get("/me/dashboard", requireAuth, users.dashboard);
router.put("/me", requireAuth, users.updateValidators, validate, users.updateMe);
router.post("/me/photo", requireAuth, photoUpload(), users.uploadPhoto);
router.delete("/me/photo", requireAuth, users.removePhoto);
router.get("/me/photo-file", requireAuth, users.photoFile);

module.exports = router;
