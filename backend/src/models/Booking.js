const mongoose = require('mongoose');
const crypto = require('crypto');

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: {
      type: String,
      unique: true,
      default: () => 'MVS-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    },

    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tripId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },

    seatLabel: { type: String, required: true },

    fareBreakdown: {
      baseFare:   { type: Number, required: true },
      bookingFee: { type: Number, default: 100 },
      total:      { type: Number, required: true },
    },

    status: {
      type: String,
      enum: ['upcoming', 'completed', 'cancelled'],
      default: 'upcoming',
    },

    paymentId:     { type: String },
    paymentMethod: { type: String, enum: ['card', 'mobile_money'], default: 'card' },
    paidAt:        { type: Date },

    // Card display (last 4 digits only — never store full card number)
    cardLast4: { type: String },
    cardType:  { type: String },

    cancelledAt:     { type: Date },
    cancellationNote: { type: String },

    // Rating submitted post-trip
    rating:  { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true },
    ratedAt: { type: Date },

    // Denormalised for fast agency-scoped revenue queries
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  },
  { timestamps: true }
);

// Indexes
bookingSchema.index({ agencyId: 1, createdAt: -1 });
bookingSchema.index({ passengerId: 1, status: 1 });
bookingSchema.index({ tripId: 1, seatLabel: 1 }, { unique: true });
bookingSchema.index({ bookingRef: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
