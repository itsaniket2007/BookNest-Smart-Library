const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { connectDb, disconnectDb } = require("../config/db");
const { User, Book, Category } = require("../models");
const { getBooksJson, getCategoriesJson, getBusinessRules } = require("../services/jsonData");
const { writeSamplePdf } = require("../utils/samplePdf");

async function seedDatabase() {
  const rules = getBusinessRules();
  const samplePath = writeSamplePdf();

  for (const category of getCategoriesJson()) {
    await Category.findOneAndUpdate(
      { slug: category.slug },
      { slug: category.slug, name: category.name, description: category.description },
      { upsert: true, new: true }
    );
  }

  for (const item of getBooksJson()) {
    const update = {
      slug: item.slug,
      title: item.title,
      author: item.author,
      category: item.category,
      price: item.price,
      year: item.year,
      cover: item.cover,
      description: item.description,
      availability: item.availability || "in-stock",
      sourceFilename: item.sourceFilename || ""
    };
    const insertOnly = {};

    if (item.attachSamplePdf) {
      // Only a newly-created sample title receives the generated sample PDF.
      // Later seeds preserve its authorization audit fields exactly as set by an
      // administrator, just like every other title.
      insertOnly.pdfFilename = "samples/booknest-authorized-sample.pdf";
      insertOnly.pdfOriginalName = "booknest-authorized-sample.pdf";
      insertOnly.pdfAuthorized = true;
      insertOnly.pdfAvailable = true;
      insertOnly.pdfAuthorizedAt = new Date();
    }

    // Catalogue JSON owns catalogue fields only.  It must not replace a
    // third-party PDF or silently change its distribution authorization.
    const operation = { $set: update };
    if (Object.keys(insertOnly).length) operation.$setOnInsert = insertOnly;
    await Book.findOneAndUpdate({ slug: item.slug }, operation, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  const adminEmail = env.adminEmail;
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      firstName: env.adminFirstName,
      lastName: env.adminLastName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(env.adminPassword, 10),
      role: "admin",
      monthlyReadingTarget: rules.monthlyReadingTarget,
      isEmailVerified: true
    });
  } else if (!existingAdmin.isEmailVerified) {
    // The configured administrator is provisioned by the trusted local seed,
    // not self-registered through the public customer flow.
    existingAdmin.isEmailVerified = true;
    await existingAdmin.save();
  }

  if (!fs.existsSync(samplePath)) {
    throw new Error("Sample PDF was not written");
  }

  const count = await Book.countDocuments();
  return { books: count, samplePdf: path.basename(samplePath) };
}

async function runCli() {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is missing. Copy .env.example to .env first.");
    process.exit(1);
  }
  await connectDb(env.mongoUri);
  const result = await seedDatabase();
  console.log("Seed complete. Books in catalogue:", result.books);
  console.log("Admin login:", env.adminEmail);
  console.log("JSON upsert finished without deleting customer carts, orders or borrowings.");
  await disconnectDb();
}

if (require.main === module) {
  runCli().catch(function (error) {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
