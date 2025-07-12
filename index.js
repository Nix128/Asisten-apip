require('dotenv').config();
const express = require('express');
const path = require('path');
// const session = require('express-session'); // Temporarily disabled for debugging
const app = express();

// SESSION MIDDLEWARE IS TEMPORARILY DISABLED FOR NETLIFY DEBUGGING
// app.use(session({
//   secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-is-long-enough',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { 
//     secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
//   }
// }));

// ROUTES
const apiRoutes = require('./routes/index');

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API ROUTES
app.use('/api', apiRoutes);

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
