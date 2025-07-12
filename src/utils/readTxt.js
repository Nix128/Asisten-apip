const fs = require('fs');

function readTxt(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = readTxt;