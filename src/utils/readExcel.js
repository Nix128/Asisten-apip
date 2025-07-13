const XLSX = require('xlsx');

/**
 * Reads an Excel file buffer and converts its content to a formatted string.
 * This function is now more robust, handling potential errors and cleaning the data.
 * @param {Buffer} buffer The buffer of the Excel file.
 * @returns {string} A formatted string representing the content of all sheets.
 * @throws {Error} If the file cannot be parsed.
 */
function readExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let result = '';

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      // Use { defval: '' } to ensure empty cells are treated as empty strings
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      result += `📄 Sheet: ${sheetName}\n---\n`;
      
      data.forEach((row) => {
        // Ensure all items in the row are strings and trim them
        const cleanedRow = row.map(cell => String(cell || '').trim());
        
        // Join the row only if it contains non-empty data
        if (cleanedRow.some(cell => cell !== '')) {
          result += cleanedRow.join(' | ') + '\n';
        }
      });

      result += '\n';
    });

    return result.trim();
  } catch (error) {
    console.error("Error parsing Excel file:", error);
    // Throw a more user-friendly error message
    throw new Error("Gagal memproses file Excel. File mungkin rusak atau formatnya tidak didukung.");
  }
}

module.exports = readExcel;
