const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const readPDF = require('./readPDF');
const readDocx = require('./readDocx');
const readTxt = require('./readTxt');
const readExcel = require('./readExcel'); // ✅ GANTI INI

async function extractZip(zipPath) {
  const dir = path.dirname(zipPath);
  const extractedDir = path.join(dir, 'extracted_' + Date.now());

  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractedDir }))
    .promise();

  const files = fs.readdirSync(extractedDir);
  let result = '';

  for (const fileName of files) {
    const filePath = path.join(extractedDir, fileName);
    const ext = path.extname(fileName).toLowerCase();

    if (ext === '.pdf') result += await readPDF(filePath);
    else if (ext === '.docx') result += await readDocx(filePath);
    else if (ext === '.txt') result += await readTxt(filePath);
    else if (ext === '.xlsx') result += await readExcel(filePath);
  }

  return result;
}

module.exports = extractZip;