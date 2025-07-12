const XLSX = require('xlsx');

function readExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let result = '';

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    result += `📄 Sheet: ${sheetName}\n`;
    data.forEach((row, idx) => {
      result += row.join(' | ') + '\n';
    });

    result += '\n';
  });

  return result.trim();
}

module.exports = readExcel;
