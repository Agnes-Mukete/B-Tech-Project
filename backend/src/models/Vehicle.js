const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId:   { type: String, required: true, unique: true, uppercase: true, trim: true },
    plateNumber: { type: String, required: true, uppercase: true, trim: true },
    type:        { type: String, enum: ['bus', 'minibus', 'van'], default: 'bus' },
    capacity:    { type: Number, required: true, min: 1 },

    status: {
      type: String,
      enum: ['active', 'idle', 'maintenance'],
      default: 'idle',
    },

    fuelLevel:     { type: Number, min: 0, max: 100, default: 100 },
    totalKm:       { type: Number, default: 0 },
    engineHours:   { type: Number, default: 0 },
    lastServiceKm: { type: Number, default: 0 },

    currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentRoute:  { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    currentTrip:   { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },

    // GPS position cache (updated via WebSocket)
    lastPosition: {
      latitude:  { type: Number },
      longitude: { type: Number },
      speed:     { type: Number, default: 0 },
      heading:   { type: Number, default: 0 },
      updatedAt: { type: Date },
    },

    maintenanceProbability: { type: Number, default: 0 },

    // Multi-tenancy scope
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  },
  { timestamps: true }
);

// Indexes
vehicleSchema.index({ agencyId: 1, status: 1 });
vehicleSchema.index({ agencyId: 1, vehicleId: 1 });
vehicleSchema.index({ currentTrip: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
