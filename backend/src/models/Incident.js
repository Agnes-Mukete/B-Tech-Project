const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    tripId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    driverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    agencyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

    type: {
      type: String,
      enum: ['mechanical', 'accident', 'passenger', 'route', 'other'],
      required: true,
    },
    priority: { type: String, enum: ['critical', 'high', 'routine'], default: 'high' },

    description: { type: String, required: true, trim: true },

    location: {
      latitude:  { type: Number },
      longitude: { type: Number },
      address:   { type: String },
    },

    status:     { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: { type: String },

    reportedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

incidentSchema.index({ agencyId: 1, status: 1 });
incidentSchema.index({ vehicleId: 1, reportedAt: -1 });
incidentSchema.index({ tripId: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
