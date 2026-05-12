require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');

const path = require('path');
const { enqueueAndAutoDrain } = require('./contactStore');
const { sendContactEmail } = require('./mailer');

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
  const emailOk = /^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email);
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
    // Enqueue for auto-send + file persistence (no DB)
    enqueueAndAutoDrain(
      { name, email, message, created_at: new Date().toISOString() },
      {
        onSend: async (item) => {
          const to = process.env.CONTACT_TO_EMAIL;
          if (!to) throw new Error('Missing CONTACT_TO_EMAIL in node-backend/.env');

          const subject = `New Contact Message from ${item.name}`;
          const text = `Name: ${item.name}\nEmail: ${item.email}\n\nMessage:\n${item.message}\n\nReceived at: ${item.created_at}`;
          await sendContactEmail({
            to: process.env.CONTACT_TO_EMAIL,
            subject: `New Contact Message from ${name}`,
            text: `
            Name: ${name}
            Email: ${email}

            Message:
            ${message}
            `
          });
          await sendContactEmail({
            to: item.email,
            subject: 'Thank You For Contacting Us',
            text: `Hi ${item.name},

            Thank you for contacting us.

            We have received your message and will get back to you within 24 hours.

            Best Regards,
            Priya`
          });
        }
      }
    );

    return res.json({
      success: true,
      message: 'Message submitted successfully'
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      success: false,
      error: 'Server error'
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
function start() {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();

