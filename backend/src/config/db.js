const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[db] MONGO_URI is not set in the environment. Exiting.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('[db] MongoDB connected successfully.');
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    // Don't let the server run against a dead DB silently.
    process.exit(1);
  }
}

module.exports = connectDB;
