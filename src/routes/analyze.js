const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const readDocx = require('../utils/readDocx');
const readPDF = require('../utils/readPDF');
const readTxt = require('../utils/readTxt');
const readExcel = require('../utils/readExcel');
const extractZip = require('../utils/extractZip');
const { analyzeImageWithVision } = require('../utils/sendToAI');
const { learnContent } = require('../utils/knowledge');

const router = express.Router();

// Use memory storage to handle files in a serverless environment
// and increase the file size limit to 100MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Tidak ada file diunggah.' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = file.buffer; // File is in memory, not on disk

  try {
    let content = '';

    if (ext === '.docx') {
      content = await readDocx(buffer);
    } else if (ext === '.pdf') {
      content = await readPDF(buffer);
    } else if (ext === '.txt') {
      content = await readTxt(buffer);
    } else if (ext === '.xlsx') {
      content = await readExcel(buffer);
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const base64Image = buffer.toString('base64');
      content = await analyzeImageWithVision(base64Image, file.mimetype);
    } else if (ext === '.zip') {
      // This is tricky, unzipper works with streams/paths. We need to write to a temp dir.
      // The /tmp/ directory is writable in most serverless environments.
      const tempDir = '/tmp';
      const tempFilePath = path.join(tempDir, file.originalname);
      await fs.promises.writeFile(tempFilePath, buffer);
      content = await extractZip(tempFilePath);
      await fs.promises.unlink(tempFilePath); // Clean up the temp file
    } else {
      return res.status(400).json({ success: false, error: 'Format file tidak didukung.' });
    }

    // Initialize context as an array if it doesn't exist
    if (!Array.isArray(req.session.fileContext)) {
      req.session.fileContext = [];
    }

    // Add the new document to the context array
    req.session.fileContext.push({
      name: file.originalname,
      content: content
    });

    // Also learn the content permanently in the background.
    // We don't await this so the user gets a faster response.
    learnContent(file.originalname, content);

    const documentList = req.session.fileContext.map(doc => doc.name).join(', ');
    res.json({ 
      success: true, 
      result: { 
        note: `Dokumen "${file.originalname}" berhasil ditambahkan ke sesi analisis. Dokumen aktif: ${documentList}` 
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Gagal menganalisis file: ' + err.message });
  }
});

// Endpoint to clear the multi-document context for a new case
router.post('/reset-context', (req, res) => {
  req.session.fileContext = [];
  res.json({ success: true, message: 'Konteks analisis multi-dokumen telah direset.' });
});

module.exports = router;
