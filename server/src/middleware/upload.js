const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getBusinessRules } = require("../services/jsonData");

const uploadRoot = path.join(__dirname, "../uploads");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(folder) {
  const dest = path.join(uploadRoot, folder);
  ensureDir(dest);
  return multer.diskStorage({
    destination: function (req, file, cb) { cb(null, dest); },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    }
  });
}

function imageFilter(req, file, cb) {
  const rules = getBusinessRules();
  if (rules.allowedImageTypes.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Choose a JPG, PNG, WebP or GIF image."));
}

function pdfFilter(req, file, cb) {
  if (file.mimetype === "application/pdf") return cb(null, true);
  cb(new Error("Only PDF files can be uploaded here."));
}

function hasSignature(filePath, kind) {
  const header = Buffer.alloc(16);
  const descriptor = fs.openSync(filePath, "r");
  try { fs.readSync(descriptor, header, 0, header.length, 0); } finally { fs.closeSync(descriptor); }
  if (kind === "pdf") return header.subarray(0, 5).toString("ascii") === "%PDF-";
  const png = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const gif = header.subarray(0, 6).toString("ascii") === "GIF87a" || header.subarray(0, 6).toString("ascii") === "GIF89a";
  const webp = header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP";
  return png || jpg || gif || webp;
}

function requireFileSignature(file, kind) {
  if (!file || !hasSignature(file.path, kind)) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error(kind === "pdf" ? "The uploaded file is not a valid PDF." : "The uploaded file is not a valid image.");
    error.statusCode = 400;
    throw error;
  }
}

function photoUpload() {
  const rules = getBusinessRules();
  return multer({
    storage: makeStorage("profiles"),
    fileFilter: imageFilter,
    limits: { fileSize: rules.maxProfileImageBytes }
  }).single("photo");
}

function coverUpload() {
  const rules = getBusinessRules();
  return multer({
    storage: makeStorage("covers"),
    fileFilter: imageFilter,
    limits: { fileSize: rules.maxCoverImageBytes }
  }).single("cover");
}

function pdfUpload() {
  const rules = getBusinessRules();
  return multer({
    storage: makeStorage("pdfs"),
    fileFilter: pdfFilter,
    limits: { fileSize: rules.maxPdfBytes }
  }).single("pdf");
}

module.exports = { photoUpload, coverUpload, pdfUpload, uploadRoot, requireFileSignature };
