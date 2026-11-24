const { Cart, Book } = require("../models");
const { roundMoney } = require("../utils/money");
const { getBusinessRules } = require("./jsonData");
const AppError = require("../utils/AppError");

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

async function summarizeCart(userId) {
  const rules = getBusinessRules();
  const cart = await getOrCreateCart(userId);
  await cart.populate("items.book");
  const items = [];
  let subtotal = 0;
  cart.items.forEach(function (item) {
    if (!item.book) return;
    const line = roundMoney(item.book.price * item.quantity);
    subtotal += line;
    items.push({
      bookId: String(item.book._id),
      quantity: item.quantity,
      unitPrice: item.book.price,
      lineTotal: line,
      book: item.book.toPublicJSON()
    });
  });
  subtotal = roundMoney(subtotal);
  const gst = roundMoney(subtotal * (rules.gstPercentage / 100));
  return {
    items: items,
    itemCount: items.reduce(function (sum, item) { return sum + item.quantity; }, 0),
    subtotal: subtotal,
    gst: gst,
    gstPercentage: rules.gstPercentage,
    total: roundMoney(subtotal + gst)
  };
}

async function addItem(userId, bookId, quantity) {
  const rules = getBusinessRules();
  const book = await Book.findById(bookId);
  if (!book) throw new AppError("That book is not in the catalogue.", 404);
  const qty = Math.min(rules.maxCartQuantity, Math.max(1, Number(quantity) || 1));
  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find(function (item) { return String(item.book) === String(bookId); });
  if (existing) existing.quantity = Math.min(rules.maxCartQuantity, existing.quantity + qty);
  else cart.items.push({ book: bookId, quantity: qty });
  await cart.save();
  return summarizeCart(userId);
}

async function updateItem(userId, bookId, quantity) {
  const rules = getBusinessRules();
  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find(function (item) { return String(item.book) === String(bookId); });
  if (!existing) throw new AppError("That book is not in your cart.", 404);
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1) {
    cart.items = cart.items.filter(function (item) { return String(item.book) !== String(bookId); });
  } else {
    existing.quantity = Math.min(rules.maxCartQuantity, qty);
  }
  await cart.save();
  return summarizeCart(userId);
}

async function removeItem(userId, bookId) {
  const cart = await getOrCreateCart(userId);
  cart.items = cart.items.filter(function (item) { return String(item.book) !== String(bookId); });
  await cart.save();
  return summarizeCart(userId);
}

async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
}

module.exports = { getOrCreateCart, summarizeCart, addItem, updateItem, removeItem, clearCart };
