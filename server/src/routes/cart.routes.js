const express = require("express");
const cart = require("../controllers/cartController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", cart.getCart);
router.post("/items", cart.addValidators, validate, cart.addItem);
router.patch("/items/:bookId", cart.patchValidators, validate, cart.updateItem);
router.delete("/items/:bookId", cart.removeItem);
router.delete("/", cart.clearCart);

module.exports = router;
