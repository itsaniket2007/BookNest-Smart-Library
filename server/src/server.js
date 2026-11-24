const env = require("./config/env");
const app = require("./app");
const { connectDb } = require("./config/db");

async function start() {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is missing. Copy .env.example to .env and add your MongoDB Atlas connection string.");
    process.exit(1);
  }
  await connectDb(env.mongoUri);
  console.log("Connected to MongoDB");
  app.listen(env.port, function () {
    console.log("BookNest running at http://localhost:" + env.port);
  });
}

start().catch(function (error) {
  console.error("Failed to start BookNest:", error.message);
  process.exit(1);
});
