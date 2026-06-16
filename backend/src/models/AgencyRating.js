const mongoose = require('mongoose');

const agencyRatingSchema = new mongoose.Schema(
  {
    agencyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    tripId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },

    score:   { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

agencyRatingSchema.index({ agencyId: 1, createdAt: -1 });
// One rating per booking — enforced by `unique: true` on the bookingId field above

module.exports = mongoose.model('AgencyRating', agencyRatingSchema);
