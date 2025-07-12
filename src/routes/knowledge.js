const express = require('express');
const router = express.Router();
const { readKnowledgeBase, writeKnowledgeBase, upsertKnowledge, getEmbedding } = require('../utils/knowledge');
const { v4: uuidv4 } = require('uuid'); // To generate unique IDs

// GET all knowledge base entries
router.get('/', async (req, res) => {
  try {
    const knowledgeBase = await readKnowledgeBase();
    res.json(knowledgeBase);
  } catch (error) {
    console.error('Error reading knowledge base:', error);
    res.status(500).json({ error: 'Failed to read knowledge base.' });
  }
});

// POST (add/update) a knowledge base entry
router.post('/', async (req, res) => {
  try {
    const { topic, content, id } = req.body;
    if (!topic || !content) {
      return res.status(400).json({ error: 'Topic and content are required.' });
    }
    
    // This is a simplified upsert for the management UI
    const knowledgeBase = await readKnowledgeBase();
    const entryId = id || uuidv4();
    const embedding = await getEmbedding(content);

    const existingIndex = knowledgeBase.findIndex(item => item.id === entryId);

    if (existingIndex > -1) {
      // Update existing
      knowledgeBase[existingIndex] = { ...knowledgeBase[existingIndex], topic, text: content, embedding };
    } else {
      // Add new
      knowledgeBase.push({ id: entryId, topic, text: content, embedding, createdAt: new Date().toISOString() });
    }

    await writeKnowledgeBase(knowledgeBase);
    res.status(201).json({ success: true, id: entryId });

  } catch (error) {
    console.error('Error upserting knowledge:', error);
    res.status(500).json({ error: 'Failed to save knowledge.' });
  }
});

// DELETE a knowledge base entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let knowledgeBase = await readKnowledgeBase();
    const initialLength = knowledgeBase.length;

    knowledgeBase = knowledgeBase.filter(item => item.id !== id);

    if (knowledgeBase.length === initialLength) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    await writeKnowledgeBase(knowledgeBase);
    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Failed to delete knowledge.' });
  }
});

module.exports = router;
