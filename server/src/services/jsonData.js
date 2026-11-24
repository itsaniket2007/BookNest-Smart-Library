const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data");

function readJson(name) {
  const raw = fs.readFileSync(path.join(dataDir, name), "utf8");
  return JSON.parse(raw);
}

function getBooksJson() {
  return readJson("books.json").books;
}

function getCategoriesJson() {
  return readJson("categories.json").categories;
}

function getBusinessRules() {
  return readJson("businessRules.json");
}

function getSiteContent() {
  return readJson("siteContent.json");
}

module.exports = {
  getBooksJson,
  getCategoriesJson,
  getBusinessRules,
  getSiteContent
};
