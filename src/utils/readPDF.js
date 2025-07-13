const pdf = require('pdf-parse');

/**
 * Reads a PDF file buffer and extracts its text content with a timeout.
 * This prevents serverless function timeouts on very large or complex PDFs.
 * @param {Buffer} buffer The buffer of the PDF file.
 * @returns {Promise<string>} A promise that resolves to the text content of the PDF.
 */
async function readPDF(buffer) {
  try {
    // Set a 9-second timeout, which is just under the typical 10-second serverless limit.
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Waktu pemrosesan PDF habis (melebihi 9 detik). File mungkin terlalu besar atau kompleks."));
      }, 9000);
    });

    // Race the PDF parsing against the timeout.
    const data = await Promise.race([
      pdf(buffer),
      timeoutPromise
    ]);

    // Return the extracted text. If no text is found (e.g., scanned image), it will be an empty string.
    return data.text;
    
  } catch (error) {
    console.error("Error parsing PDF file:", error.message);
    // Re-throw the original error or the timeout error to be caught by the global handler.
    throw error;
  }
}

module.exports = readPDF;
