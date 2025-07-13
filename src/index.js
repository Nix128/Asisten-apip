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
const apiRoutes = require('./routes/index');
const multer = require('multer'); // Import multer to check for its errors

// MIDDLEWARE
// Increase payload limits to handle larger files and data
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API ROUTES
app.use('/api', apiRoutes);

// FALLBACK: UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GLOBAL ERROR HANDLING MIDDLEWARE
// This must be the last 'app.use()'
app.use((err, req, res, next) => {
  console.error("💥 Global Error Handler Caught:", err);

  // Check if the error is from Multer (e.g., file too large)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `Kesalahan unggah file: ${err.message}. Pastikan file tidak melebihi 100MB.`
    });
  }

  // Handle other errors
  // Ensure we always send a JSON response
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan internal pada server: ' + (err.message || 'Error tidak diketahui')
  });
});


// SERVER
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Sahabat APIP siap membantu di http://localhost:${PORT}`);
  });
}

module.exports = app;
