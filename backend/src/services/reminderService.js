/**
 * reminderService.js
 * Cron job runs every 5 minutes and sends two departure reminders per trip:
 *   • 30-minute reminder  (window: 25–35 min before departure)
 *   • 15-minute reminder  (window: 10–20 min before departure)
 * Each passenger with an upcoming booking receives:
 *   • an in-app notification
 *   • an email reminder
 * Trip fields reminder30SentAt / reminder15SentAt prevent duplicate sends.
 */
const cron         = require('node-cron');
const Trip         = require('../models/Trip');
const Booking      = require('../models/Booking');
const User         = require('../models/User');
const emailService = require('./emailService');
const notify       = require('../utils/notify');
const logger       = require('../utils/logger');

// ── Shared helper — send reminders for a set of trips ────────────────────────
async function dispatchReminders(trips, minutesLeft, flagField) {
  const now = new Date();

  for (const trip of trips) {
    try {
      const bookings = await Booking.find({ tripId: trip._id, status: 'upcoming' });

      // Mark even if no passengers so we don't re-query
      trip[flagField] = now;
      await trip.save();

      if (bookings.length === 0) continue;

      const passengerIds = bookings.map(b => b.passengerId);
      const passengers   = await User.find({ _id: { $in: passengerIds } }).select('name email');
      const passengerMap = Object.fromEntries(passengers.map(p => [String(p._id), p]));

      const route = trip.routeId;
      const depTime = new Date(trip.scheduledStart).toLocaleString('en-CM', {
        dateStyle: 'medium', timeStyle: 'short',
      });

      for (const booking of bookings) {
        const passenger = passengerMap[String(booking.passengerId)];
        if (!passenger) continue;

        // In-app notification
        notify(
          booking.passengerId,
          'trip_reminder',
          `${minutesLeft <= 15 ? '⚠️' : '🕐'} Departure in ${minutesLeft} minutes`,
          `Your trip from ${route.origin} to ${route.destination} (Seat ${booking.seatLabel}) departs at ${depTime}. ${minutesLeft <= 15 ? 'Head to the boarding point immediately!' : 'Please start heading to the boarding point.'}`,
          '/passenger/bookings'
        ).catch(() => {});

        // Email
        emailService.sendDepartureReminder(passenger, trip, route, booking, minutesLeft)
          .catch(e => logger.error(`Reminder email (${minutesLeft}min) failed for ${passenger.email}:`, e.message));
      }

      logger.info(`${minutesLeft}-min reminders sent for trip ${trip.tripId} (${bookings.length} passenger(s))`);
    } catch (err) {
      logger.error(`Reminder error for trip ${trip._id}:`, err.message);
    }
  }
}

// ── Main check function ────────────────────────────────────────────────────
async function sendDepartureReminders() {
  const now = new Date();

  // 30-minute window: departing 25–35 min from now
  const w30Start = new Date(now.getTime() + 25 * 60 * 1000);
  const w30End   = new Date(now.getTime() + 35 * 60 * 1000);

  // 15-minute window: departing 10–20 min from now
  const w15Start = new Date(now.getTime() + 10 * 60 * 1000);
  const w15End   = new Date(now.getTime() + 20 * 60 * 1000);

  const [trips30, trips15] = await Promise.all([
    Trip.find({
      status:           'scheduled',
      reminder30SentAt: null,
      scheduledStart:   { $gte: w30Start, $lte: w30End },
    }).populate('routeId', 'name origin destination'),

    Trip.find({
      status:           'scheduled',
      reminder15SentAt: null,
      scheduledStart:   { $gte: w15Start, $lte: w15End },
    }).populate('routeId', 'name origin destination'),
  ]);

  if (trips30.length > 0) {
    logger.info(`Reminder check: ${trips30.length} trip(s) for 30-min reminder`);
    await dispatchReminders(trips30, 30, 'reminder30SentAt');
  }

  if (trips15.length > 0) {
    logger.info(`Reminder check: ${trips15.length} trip(s) for 15-min reminder`);
    await dispatchReminders(trips15, 15, 'reminder15SentAt');
  }
}

// ── Start cron ─────────────────────────────────────────────────────────────
function startReminderCron() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendDepartureReminders();
    } catch (err) {
      logger.error('Reminder cron error:', err.message);
    }
  });

  logger.info('Departure reminder cron started (runs every 5 minutes)');
}

module.exports = { startReminderCron, sendDepartureReminders };
