require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();

// SESSION MIDDLEWARE
// Using express-session without a store defaults to MemoryStore,
// which is fine for serverless as it still sets the cookie correctly.
app.use(session({
  secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-is-long-enough',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
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
