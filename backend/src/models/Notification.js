const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:    {
      type: String,
      enum: [
        'trip_assigned', 'trip_started', 'trip_completed', 'trip_cancelled',
        'booking_confirmed', 'booking_cancelled',
        'incident_reported', 'incident_resolved',
        'agency_approved', 'agency_suspended',
        'account_locked', 'general',
      ],
      default: 'general',
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    link:    { type: String },          // optional client-side route to navigate to
    read:    { type: Boolean, default: false, index: true },
    readAt:  { type: Date },
  },
  { timestamps: true }
);

// Compound index for fast per-user unread queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
