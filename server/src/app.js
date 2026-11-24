const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const env = require("./config/env");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const projectRoot = path.join(__dirname, "../..");

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: env.clientOrigin,
  credentials: true
}));
app.use(morgan(env.nodeEnv === "test" ? "tiny" : "dev"));
// Razorpay signs the exact raw request body. This must be registered before
// the JSON body parser so signature verification is meaningful.
app.use("/api/webhooks", require("./routes/webhook.routes"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (env.nodeEnv !== "test") {
  app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please wait and try again." }
  }));
}

app.get("/api/health", function (req, res) {
  const readyState = mongoose.connection.readyState;
  const databaseConnected = readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? "ok" : "degraded",
    service: "BookNest API",
    express: { status: "running" },
    mongodb: { connected: databaseConnected, readyState: readyState },
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/books", require("./routes/book.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/cart", require("./routes/cart.routes"));
app.use("/api/wishlist", require("./routes/wishlist.routes"));
app.use("/api/borrowings", require("./routes/borrowing.routes"));
app.use("/api/reading", require("./routes/reading.routes"));
app.use("/api/orders", require("./routes/order.routes"));
app.use("/api/feedback", require("./routes/feedback.routes"));

app.use("/css", express.static(path.join(projectRoot, "css")));
app.use("/js", express.static(path.join(projectRoot, "js")));
app.use(express.static(path.join(projectRoot, "html")));

app.get("/", function (req, res) {
  res.sendFile(path.join(projectRoot, "html/index.html"));
});

app.use("/api", function (req, res) {
  res.status(404).json({ success: false, message: "API route not found." });
});

app.use(errorHandler);

module.exports = app;
