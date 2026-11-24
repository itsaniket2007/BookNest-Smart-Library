const fs = require("fs");
const path = require("path");

function streamObject(id, text) {
  const stream = "BT /F1 16 Tf 72 720 Td (" + text + ") Tj ET";
  return id + " 0 obj << /Length " + Buffer.byteLength(stream) + " >> stream\n" + stream + "\nendstream\nendobj\n";
}

function buildSamplePdf() {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj\n",
    "4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj\n",
    streamObject(5, "BookNest Authorized Sample Reader - page 1 of 2"),
    streamObject(6, "Zoom, next, previous and fullscreen - page 2 of 2"),
    "7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(function (object) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  });
  const xrefStart = Buffer.byteLength(body);
  let xref = "xref\n0 8\n0000000000 65535 f \n";
  for (let i = 1; i <= 7; i += 1) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  body += xref + "trailer << /Size 8 /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF\n";
  return Buffer.from(body, "latin1");
}

function writeSamplePdf() {
  const filePath = path.join(__dirname, "../uploads/samples/booknest-authorized-sample.pdf");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildSamplePdf());
  return filePath;
}

module.exports = { buildSamplePdf, writeSamplePdf };
