const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  data: {
    type: Buffer,
    required: true,
  },
  mimeType: {
    type: String,
    default: 'application/pdf',
  },
  createdAt: {
    type: Date,
    expires: '7d', // automatically delete after 7 days
  },
}, { timestamps: true });

module.exports = mongoose.model('Pdf', pdfSchema);
