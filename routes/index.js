const express = require('express');
const router = express.Router();

const analyzeRoutes = require('./analyze');
const chatRoutes = require('./chat');
const generateRoutes = require('./generate');
const knowledgeRoutes = require('./knowledge');

router.use('/analyze', analyzeRoutes);
router.use('/chat', chatRoutes);
router.use('/generate', generateRoutes);
router.use('/knowledge', knowledgeRoutes);

// A simple test route to confirm the master router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Master API router is working!' });
});

module.exports = router;
