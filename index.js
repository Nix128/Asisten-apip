require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const app = express();

// SESSION MIDDLEWARE
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'a-very-secret-key-that-is-long-enough'],
  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 * 7, // 7 days
  httpOnly: true,
}));

// ROUTES
const analyzeRoutes = require('./routes/analyze');
const chatRoutes = require('./routes/chat');
const generateRoutes = require('./routes/generate');
const knowledgeRoutes = require('./routes/knowledge');

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API ROUTES
app.use('/api/analyze', analyzeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// FALLBACK: UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SERVER
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Sahabat APIP siap membantu di http://localhost:${PORT}`);
  });
}

module.exports = app;
