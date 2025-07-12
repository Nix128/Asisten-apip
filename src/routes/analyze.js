const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const readDocx = require('../utils/readDocx');
const readPDF = require('../utils/readPDF');
const readTxt = require('../utils/readTxt');
const readExcel = require('../utils/readExcel');
const extractZip = require('../utils/extractZip');
const { upsertKnowledge } = require('../utils/knowledge');

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Tidak ada file diunggah.' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = path.resolve(file.path);

  try {
    let content = '';

    if (ext === '.docx') {
      const buffer = fs.readFileSync(filePath);
      content = await readDocx(buffer);
    } else if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      content = await readPDF(buffer);
    } else if (ext === '.txt') {
      const buffer = fs.readFileSync(filePath);
      content = await readTxt(buffer);
    } else if (ext === '.xlsx') {
      const buffer = fs.readFileSync(filePath);
      content = await readExcel(buffer);
    } else if (ext === '.zip') {
      content = await extractZip(filePath);
    } else {
      return res.status(400).json({ success: false, error: 'Format file tidak didukung.' });
    }

    fs.unlinkSync(filePath); // Hapus file setelah diproses

    // Initialize context as an array if it doesn't exist
    if (!Array.isArray(req.session.fileContext)) {
      req.session.fileContext = [];
    }

    // Add the new document to the context array
    req.session.fileContext.push({
      name: file.originalname,
      content: content
    });

    // Learn the content permanently
    await upsertKnowledge(file.originalname, content);
    console.log(`Knowledge from "${file.originalname}" has been learned and stored.`);

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
