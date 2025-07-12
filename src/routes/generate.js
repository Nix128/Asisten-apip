const express = require('express');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const router = express.Router();

router.post('/docx', async (req, res) => {
  try {
    const { textContent } = req.body;

    if (!textContent) {
      return res.status(400).send('Text content is required.');
    }

    // Split the text into paragraphs based on newline characters
    const paragraphs = textContent.split('\n').map(line => 
      new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 200 }, // Add some space after each paragraph
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Sahabat_APIP.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);

  } catch (error) {
    console.error('Error generating DOCX:', error);
    res.status(500).send('Failed to generate document.');
  }
});

module.exports = router;
