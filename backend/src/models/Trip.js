const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  label:     { type: String, required: true },   // e.g. A1, B3
  status:    { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
  heldBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  heldUntil: { type: Date, default: null },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
});

const tripSchema = new mongoose.Schema(
  {
    tripId: { type: String, required: true, uppercase: true, trim: true },

    routeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    scheduledStart: { type: Date, required: true },
    scheduledEnd:   { type: Date, required: true },
    actualStart:    { type: Date },
    actualEnd:      { type: Date },

    status: {
      type: String,
      enum: ['scheduled', 'inProgress', 'completed', 'cancelled'],
      default: 'scheduled',
    },

    passengerCount: { type: Number, default: 0 },
    seats:          [seatSchema],

    fare: { type: Number, required: true },

    // Multi-tenancy scope — must match routeId.agencyId, vehicleId.agencyId, driverId.agencyId
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

    // Departure reminder tracking — set once each reminder has been dispatched
    reminder30SentAt: { type: Date, default: null },
    reminder15SentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
tripSchema.index({ agencyId: 1, status: 1 });
tripSchema.index({ agencyId: 1, scheduledStart: 1 });
tripSchema.index({ driverId: 1, scheduledStart: 1 });
tripSchema.index({ vehicleId: 1, scheduledStart: 1 });
tripSchema.index({ routeId: 1, agencyId: 1 });
tripSchema.index({ tripId: 1, agencyId: 1 }, { unique: true });

module.exports = mongoose.model('Trip', tripSchema);
