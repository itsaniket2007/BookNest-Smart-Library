const { Wishlist } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { Book } = require("../models");
const cartService = require("../services/cartService");

async function getOrCreate(userId) {
  let list = await Wishlist.findOne({ user: userId });
  if (!list) list = await Wishlist.create({ user: userId, books: [] });
  return list;
}

function serialize(list) {
  return (list.books || []).filter(Boolean).map(function (book) {
    return book.toPublicJSON ? book.toPublicJSON() : book;
  });
}

const getWishlist = asyncHandler(async function getWishlist(req, res) {
  const list = await getOrCreate(req.user._id);
  await list.populate("books");
  res.json({ success: true, wishlist: serialize(list) });
});

const addWishlist = asyncHandler(async function addWishlist(req, res) {
  const book = await Book.findById(req.params.bookId);
  if (!book) throw new AppError("Book not found.", 404);
  const list = await getOrCreate(req.user._id);
  const exists = list.books.some(function (id) { return String(id) === String(book._id); });
  if (!exists) list.books.push(book._id);
  await list.save();
  await list.populate("books");
  res.status(exists ? 200 : 201).json({
    success: true,
    message: exists ? "Already in your wishlist." : "Added to wishlist.",
    wishlist: serialize(list)
  });
});

const removeWishlist = asyncHandler(async function removeWishlist(req, res) {
  const list = await getOrCreate(req.user._id);
  list.books = list.books.filter(function (id) { return String(id) !== String(req.params.bookId); });
  await list.save();
  await list.populate("books");
  res.json({ success: true, message: "Removed from wishlist.", wishlist: serialize(list) });
});

const moveToCart = asyncHandler(async function moveToCart(req, res) {
  const list = await getOrCreate(req.user._id);
  const found = list.books.some(function (id) { return String(id) === String(req.params.bookId); });
  if (!found) throw new AppError("That book is not in your wishlist.", 404);
  const cart = await cartService.addItem(req.user._id, req.params.bookId, 1);
  res.json({ success: true, message: "Moved to cart. It also stays in your wishlist.", cart: cart });
});

module.exports = { getWishlist, addWishlist, removeWishlist, moveToCart };
