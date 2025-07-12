require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const app = express();

// SESSION MIDDLEWARE
const fileStoreOptions = {
  path: './memory/sessions', // Store sessions in a dedicated folder
  reapInterval: 3600, // Clean up expired sessions every hour
};

app.use(session({
  store: new FileStore(fileStoreOptions),
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true, // Set to true to save new sessions with chat history
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
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
app.listen(PORT, () => {
  console.log(`✅ Sahabat APIP siap membantu di http://localhost:${PORT}`);
});
