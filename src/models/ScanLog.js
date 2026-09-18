const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema(
  {
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      index: true,
    },
    registrationId: {
      type: String,
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    profession: {
      type: String,
      default: 'Delegate',
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    scanDate: {
      type: String, // Format: 'YYYY-MM-DD'
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast daily deduplication lookups
scanLogSchema.index({ scanDate: 1, registrationId: 1 });

module.exports = mongoose.model('ScanLog', scanLogSchema);
