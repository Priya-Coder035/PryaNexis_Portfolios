const express = require('express');
const path = require('path');
const { ensureTables, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Serve frontend files
app.use(express.static(path.join(__dirname, '..')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Helper function
function invalidJson(res, message) {
  return res.status(400).json({
    success: false,
    error: message
  });
}

// Contact API
app.post('/api/contact', async (req, res) => {
  const contentType = req.headers['content-type'] || '';

  let payload = {};

  if (contentType.includes('application/json')) {
    if (req.body && typeof req.body === 'object') {
      payload = req.body;
    } else {
      return invalidJson(res, 'Invalid JSON body');
    }
  } else {
    payload = req.body || {};
  }

  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim();
  const message = String(payload.message ?? '').trim();

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: 'name, email, and message are required'
    });
  }

  // Email validation
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailOk) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email address'
    });
  }

  // Length validation
  if (name.length > 120 || message.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Input too long'
    });
  }

  try {
    // Save to database
    await pool.query(
      'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
      [name, email, message]
    );

    return res.json({
      success: true,
      message: 'Message submitted successfully'
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      success: false,
      error: 'Database error'
    });
  }
});

// Handle wrong methods
app.all('/api/contact', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
});

// Start server
async function start() {
  try {
    await ensureTables();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
