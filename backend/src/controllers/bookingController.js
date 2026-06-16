const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { success, created, notFound, badRequest, forbidden, paginate } = require('../utils/response');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const notify = require('../utils/notify');

const HOLD_MINUTES = 10;
const axios = require('axios');

// The hostname 'movesmart-ml' matches the service name in docker-compose
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://movesmart-ml:8000';

const getPredictedDemand = async (agencyId, routeId, dayOfWeek, hourOfDay) => {
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict/demand`, {
            agency_id: agencyId,
            route_id: routeId,
            day_of_week: dayOfWeek,
            hour_of_day: hourOfDay
        });
        return response.data.predicted_passenger_demand;
    } catch (error) {
        console.error("Failed to fetch ML insights:", error.message);
        return null; // Graceful fallback
    }
};
// ── POST /api/bookings  (passenger) ──────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { tripId, seatLabel, paymentMethod = 'card', cardLast4, cardType } = req.body;

    const trip = await Trip.findById(tripId).populate('routeId', 'name origin destination baseFare agencyId');
    if (!trip) return notFound(res, 'Trip not found');
    if (trip.status !== 'scheduled') return badRequest(res, 'Trip is no longer available for booking');

    // Check seat
    const seat = trip.seats.find(s => s.label === seatLabel);
    if (!seat) return notFound(res, `Seat ${seatLabel} does not exist on this trip`);

    const now = new Date();
    if (seat.status === 'booked') return badRequest(res, `Seat ${seatLabel} is already booked`);
    if (seat.status === 'held' && seat.heldUntil > now && String(seat.heldBy) !== String(req.user._id)) {
      return badRequest(res, `Seat ${seatLabel} is currently held by another passenger`);
    }

    // Hold the seat for HOLD_MINUTES
    seat.status = 'held';
    seat.heldBy = req.user._id;
    seat.heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60000);
    await trip.save();

    // Simulate payment (integration point for real gateway)
    const paymentId = `PAY-${Date.now()}`;
    const baseFare = trip.fare;
    const bookingFee = 100;

    const booking = await Booking.create({
      passengerId: req.user._id,
      tripId: trip._id,
      seatLabel,
      fareBreakdown: { baseFare, bookingFee, total: baseFare + bookingFee },
      paymentId,
      paymentMethod,
      paidAt: new Date(),
      cardLast4,
      cardType,
      agencyId: trip.agencyId,
    });

    // Confirm seat as booked
    seat.status = 'booked';
    seat.heldBy = null;
    seat.heldUntil = null;
    seat.bookingId = booking._id;
    trip.passengerCount += 1;
    await trip.save();

    // Send confirmation email (FR-PA24) — fire-and-forget
    User.findById(req.user._id).then(passenger => {
      if (passenger && trip.routeId) {
        emailService.sendBookingConfirmation(booking, passenger, trip, trip.routeId)
          .catch(e => logger.error('Booking email failed:', e));
      }
    }).catch(() => {});

    notify(req.user._id, 'booking_confirmed', 'Booking confirmed', `Your booking ${booking.bookingRef} has been confirmed. Seat: ${booking.seatLabel}`, '/passenger/bookings').catch(() => {});

    return created(res, booking, `Booking confirmed! Reference: ${booking.bookingRef}`);
  } catch (err) { next(err); }
};

// ── GET /api/bookings/my  (passenger) ────────────────────────────────
exports.myBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { passengerId: req.user._id };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate({
          path: 'tripId',
          select: 'scheduledStart scheduledEnd status',
          populate: { path: 'routeId', select: 'name origin destination' },
        })
        .populate('agencyId', 'name shortCode logoColor')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(filter),
    ]);

    return paginate(res, bookings, page, limit, total, 'Booking history retrieved');
  } catch (err) { next(err); }
};

// ── DELETE /api/bookings/:id  (cancel – passenger, 2hr rule) ─────────
exports.cancel = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, passengerId: req.user._id });
    if (!booking) return notFound(res, 'Booking not found');
    if (booking.status !== 'upcoming') return badRequest(res, 'Only upcoming bookings can be cancelled');

    const trip = await Trip.findById(booking.tripId);
    if (!trip) return notFound(res, 'Associated trip not found');

    const twoHoursBefore = new Date(trip.scheduledStart.getTime() - 2 * 60 * 60 * 1000);
    if (new Date() > twoHoursBefore) {
      return badRequest(res, 'Cancellations are only allowed up to 2 hours before departure');
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    // Release the seat
    const seat = trip.seats.find(s => s.label === booking.seatLabel);
    if (seat) {
      seat.status = 'available';
      seat.bookingId = null;
      trip.passengerCount = Math.max(0, trip.passengerCount - 1);
      await trip.save();
    }

    notify(booking.passengerId, 'booking_cancelled', 'Booking cancelled', `Your booking ${booking.bookingRef} has been cancelled. Refund will be processed within 3–5 business days.`, '/passenger/bookings').catch(() => {});

    return success(res, booking, 'Booking cancelled. Refund will be processed within 3–5 business days.');
  } catch (err) { next(err); }
};

// ── GET /api/bookings/:id ────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('tripId')
      .populate('agencyId', 'name shortCode logoColor ownerPhone');

    if (!booking) return notFound(res, 'Booking not found');

    // Passengers can only see their own bookings; admins and fleet managers see all (agency-scoped)
    if (req.user.role === 'passenger' && String(booking.passengerId) !== String(req.user._id)) {
      return forbidden(res, 'Access denied');
    }

    return success(res, booking);
  } catch (err) { next(err); }
};
