const express = require("express");
const wishlist = require("../controllers/wishlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", wishlist.getWishlist);
router.post("/:bookId/to-cart", wishlist.moveToCart);
router.post("/:bookId", wishlist.addWishlist);
router.delete("/:bookId", wishlist.removeWishlist);

module.exports = router;
