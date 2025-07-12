const express = require('express');
const router = express.Router();
const { getKnowledgeCollection } = require('../utils/knowledge');
const { ObjectId } = require('mongodb'); // To handle MongoDB's unique IDs

// GET all knowledge base entries
router.get('/', async (req, res) => {
  try {
    const knowledgeCollection = await getKnowledgeCollection();
    const knowledgeBase = await knowledgeCollection.find({}).sort({ createdAt: -1 }).toArray();
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
    
    const knowledgeCollection = await getKnowledgeCollection();
    const { getEmbedding } = require('../utils/knowledge');
    const embedding = await getEmbedding(content);

    if (id) {
      // Update existing
      const result = await knowledgeCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { topic, text: content, embedding } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Entry not found for update.' });
      }
    } else {
      // Add new
      await knowledgeCollection.insertOne({
        topic,
        text: content,
        embedding,
        createdAt: new Date(),
      });
    }

    res.status(201).json({ success: true });

  } catch (error) {
    console.error('Error upserting knowledge:', error);
    res.status(500).json({ error: 'Failed to save knowledge.' });
  }
});

// DELETE a knowledge base entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const knowledgeCollection = await getKnowledgeCollection();
    const result = await knowledgeCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Failed to delete knowledge.' });
  }
});

module.exports = router;
