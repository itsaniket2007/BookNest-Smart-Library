const { Order, Borrowing } = require("../models");

async function canReadPdf(user, book) {
  if (!book) return { ok: false, message: "Book not found." };
  if (user && user.role === "admin") {
    if (!book.pdfFilename) return { ok: false, message: "No PDF file is stored for this book." };
    return { ok: true, reason: "admin" };
  }
  if (!book.pdfAuthorized || !book.pdfAvailable || !book.pdfFilename) {
    return { ok: false, message: "This PDF is not authorized for distribution." };
  }
  if (!user) return { ok: false, message: "Log in to read this book." };

  const purchased = await Order.exists({ user: user._id, "items.book": book._id });
  if (purchased) return { ok: true, reason: "purchase" };

  const borrowed = await Borrowing.exists({
    user: user._id,
    book: book._id,
    returnedAt: null,
    dueAt: { $gte: new Date() }
  });
  if (borrowed) return { ok: true, reason: "borrow" };

  return { ok: false, message: "Buy or borrow this book to read the authorized PDF." };
}

module.exports = { canReadPdf };
