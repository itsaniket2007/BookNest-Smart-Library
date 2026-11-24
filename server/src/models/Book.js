const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    year: { type: Number, default: null },
    cover: { type: String, default: "cover-purple" },
    coverImageFilename: { type: String, default: "" },
    coverImageOriginalName: { type: String, default: "" },
    description: { type: String, required: true },
    availability: { type: String, enum: ["in-stock", "unavailable"], default: "in-stock" },
    sourceFilename: { type: String, default: "" },
    pdfFilename: { type: String, default: "" },
    pdfOriginalName: { type: String, default: "" },
    pdfPageCount: { type: Number, default: 0 },
    pdfAuthorized: { type: Boolean, default: false },
    pdfAvailable: { type: Boolean, default: false },
    pdfAuthorizedAt: { type: Date, default: null },
    pdfAuthorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

bookSchema.index({ title: "text", author: "text", description: "text" });
bookSchema.index({ price: 1 });
bookSchema.index({ year: 1 });

bookSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: String(this._id),
    slug: this.slug,
    title: this.title,
    author: this.author,
    category: this.category,
    price: this.price,
    year: this.year,
    cover: this.cover,
    coverImageUrl: this.coverImageFilename ? "/api/books/" + this._id + "/cover" : "",
    coverImageName: this.coverImageOriginalName || "",
    hasCoverImage: Boolean(this.coverImageFilename),
    description: this.description,
    availability: this.availability,
    pdfAuthorized: this.pdfAuthorized,
    pdfAvailable: Boolean(this.pdfAvailable && this.pdfAuthorized && this.pdfFilename),
    hasPdfFile: Boolean(this.pdfFilename),
    pdfOriginalName: this.pdfOriginalName || ""
  };
};

module.exports = mongoose.model("Book", bookSchema);
