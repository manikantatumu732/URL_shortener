const mongoose = require('mongoose');
const { Schema } = mongoose;

const AnalyticsEventSchema = new Schema({
  linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  country: String,
  city: String,
  browser: String,
  os: String,
  device: String,
  referrer: String,
  ipHash: String
});

module.exports = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
