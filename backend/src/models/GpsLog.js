const mongoose = require('mongoose');

const gpsLogSchema = new mongoose.Schema(
  {
    tripId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    agencyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed:     { type: Number, default: 0 },
    heading:   { type: Number, default: 0 },
    altitude:  { type: Number },

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Compound index for time-series queries
gpsLogSchema.index({ tripId: 1, timestamp: -1 });
gpsLogSchema.index({ agencyId: 1, vehicleId: 1, timestamp: -1 });
// TTL index — auto-delete logs older than 365 days (FR retention policy)
gpsLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('GpsLog', gpsLogSchema);
