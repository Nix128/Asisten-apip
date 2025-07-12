const mammoth = require('mammoth');

async function readDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

module.exports = readDocx; // Export sebagai fungsi default