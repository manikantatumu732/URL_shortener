require('dotenv').config();

// Fail loudly at startup if JWT_SECRET is missing, not silently at first request.
if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set in the environment. Exiting.');
  process.exit(1);
}

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', linkRoutes);
app.use('/', redirectRoutes);

// Fallback handler for malformed JSON bodies etc. — don't crash.
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 400).json({ error: err.message || 'Bad request' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
  });
});
