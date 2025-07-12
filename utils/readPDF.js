const pdf = require('pdf-parse');

/**
 * Membaca isi teks dari file PDF (Buffer).
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
async function readPDF(buffer) {
  const data = await pdf(buffer);
  return data.text.trim();
}

module.exports = readPDF;
