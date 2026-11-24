const { body, param } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const cartService = require("../services/cartService");

const addValidators = [
  body("bookId").isMongoId().withMessage("Choose a valid book."),
  body("quantity").optional().isInt({ min: 1, max: 99 })
];

const patchValidators = [
  param("bookId").isMongoId(),
  body("quantity").isInt({ min: 0, max: 99 }).withMessage("Enter a valid quantity.")
];

const getCart = asyncHandler(async function getCart(req, res) {
  const cart = await cartService.summarizeCart(req.user._id);
  res.json({ success: true, cart: cart });
});

const addItem = asyncHandler(async function addItem(req, res) {
  const cart = await cartService.addItem(req.user._id, req.body.bookId, req.body.quantity || 1);
  res.status(201).json({ success: true, message: "Added to cart.", cart: cart });
});

const updateItem = asyncHandler(async function updateItem(req, res) {
  const cart = await cartService.updateItem(req.user._id, req.params.bookId, req.body.quantity);
  res.json({ success: true, message: "Cart updated.", cart: cart });
});

const removeItem = asyncHandler(async function removeItem(req, res) {
  const cart = await cartService.removeItem(req.user._id, req.params.bookId);
  res.json({ success: true, message: "Removed from cart.", cart: cart });
});

const clearCart = asyncHandler(async function clearCart(req, res) {
  await cartService.clearCart(req.user._id);
  res.json({ success: true, message: "Cart cleared.", cart: await cartService.summarizeCart(req.user._id) });
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, addValidators, patchValidators };
