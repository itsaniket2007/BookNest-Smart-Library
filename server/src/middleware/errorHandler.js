const AppError = require("../utils/AppError");

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  if (err && err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message || "Invalid request." });
  }

  if (err && err.name === "ValidationError") {
    const message = Object.values(err.errors).map(function (item) { return item.message; }).join(" ");
    return res.status(400).json({ success: false, message: message });
  }

  if (err && err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid record identifier." });
  }

  if (err && err.name === "MulterError") {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong on the server." });
}

module.exports = errorHandler;
