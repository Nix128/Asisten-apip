const pdf = require('pdf-parse');

/**
 * Reads a PDF file buffer and extracts its text content.
 * This version uses pdf-parse and includes robust error handling.
 * @param {Buffer} buffer The buffer of the PDF file.
 * @returns {Promise<string>} A promise that resolves to the text content of the PDF.
 */
async function readPDF(buffer) {
  try {
    // Options can be passed to pdf-parse if needed, but defaults are usually fine.
    const data = await pdf(buffer);
    // Return the extracted text. If no text is found (e.g., scanned image), it will be an empty string.
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF file with pdf-parse:", error);
    // This will catch errors from corrupted or malformed PDFs.
    // We throw a new error to be caught by the route handler.
    throw new Error("Gagal memproses file PDF. File mungkin rusak, dilindungi kata sandi, atau formatnya tidak didukung.");
  }
}

module.exports = readPDF;
