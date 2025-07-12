function readTxt(buffer) {
  // Txt files are simple, just convert the buffer to a UTF-8 string.
  return buffer.toString('utf8');
}

module.exports = readTxt;
