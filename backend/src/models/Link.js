const mongoose = require('mongoose');
const { Schema } = mongoose;

const LinkSchema = new Schema({
  shortCode: { type: String, required: true, unique: true, index: true },
  originalUrl: { type: String, required: true },
  customAlias: { type: String, unique: true, sparse: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // optional, null if anonymous
  clicks: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Link', LinkSchema);
