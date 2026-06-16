const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const User = require('../models/User');
const { success, created, notFound, badRequest, forbidden, paginate } = require('../utils/response');
const notify = require('../utils/notify');
const { assertSameAgency, isPlatformAdmin } = require('../middleware/rbac');

// Generate seat map for a vehicle capacity
const generateSeats = (capacity) => {
  const seats = [];
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const cols = 4;
  let count = 0;
  for (let r = 0; r < rows.length && count < capacity; r++) {
    for (let c = 1; c <= cols && count < capacity; c++) {
      seats.push({ label: `${rows[r]}${c}`, status: 'available' });
      count++;
    }
  }
  return seats;
};

// ── GET /api/trips ───────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { status, driverId, vehicleId, routeId, date, dateFrom, dateTo, page = 1, limit = 100 } = req.query;
    const filter = { ...req.agencyFilter };

    if (status) filter.status = status;

    // Drivers can only see their own trips — enforce server-side regardless of query param
    if (req.user.role === 'driver') {
      filter.driverId = req.user._id;
    } else if (driverId) {
      filter.driverId = driverId;
    }

    if (vehicleId) filter.vehicleId = vehicleId;
    if (routeId) filter.routeId = routeId;

    // Single-day filter (legacy)
    if (date) {
      const day = new Date(date);
      filter.scheduledStart = { $gte: day, $lt: new Date(day.getTime() + 86_400_000) };
    } else if (dateFrom || dateTo) {
      // Week / range filter
      filter.scheduledStart = {};
      if (dateFrom) filter.scheduledStart.$gte = new Date(dateFrom);
      if (dateTo)   filter.scheduledStart.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .populate('routeId', 'name origin destination')
        .populate('vehicleId', 'vehicleId plateNumber capacity')
        .populate('driverId', 'name')
        .sort({ scheduledStart: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Trip.countDocuments(filter),
    ]);
    return paginate(res, trips, page, limit, total);
  } catch (err) { next(err); }
};

// ── POST /api/trips ──────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { routeId, vehicleId, driverId, scheduledStart, scheduledEnd, fare } = req.body;

    // All referenced resources must belong to the same agency
    const [route, vehicle, driver] = await Promise.all([
      Route.findById(routeId),
      Vehicle.findById(vehicleId),
      User.findById(driverId),
    ]);

    if (!route) return notFound(res, 'Route not found');
    if (!vehicle) return notFound(res, 'Vehicle not found');
    if (!driver) return notFound(res, 'Driver not found');

    const agencyId = isPlatformAdmin(req.user) ? route.agencyId : req.user.agencyId;

    // Enforce cross-resource agency consistency
    if (
      String(route.agencyId) !== String(agencyId) ||
      String(vehicle.agencyId) !== String(agencyId) ||
      String(driver.agencyId) !== String(agencyId)
    ) {
      return forbidden(res, 'All trip resources must belong to the same agency');
    }

    // Prevent double-booking of vehicle or driver.
    // Two intervals [A,B] and [C,D] overlap when A < D && C < B.
    // We cannot use two top-level $or keys — JS silently drops the first.
    // Use $and to combine both conditions correctly.
    const newStart = new Date(scheduledStart);
    const newEnd   = new Date(scheduledEnd);
    const overlap = await Trip.findOne({
      agencyId,
      $and: [
        { $or: [{ vehicleId }, { driverId }] },
        { status: { $in: ['scheduled', 'inProgress'] } },
        { scheduledStart: { $lt: newEnd } },
        { scheduledEnd:   { $gt: newStart } },
      ],
    });
    if (overlap) return badRequest(res, 'Vehicle or driver already scheduled in this time slot');

    const tripId = `T${Date.now()}`;
    const seats = generateSeats(vehicle.capacity);

    const trip = await Trip.create({
      tripId, routeId, vehicleId, driverId,
      scheduledStart, scheduledEnd,
      fare: fare || route.baseFare,
      seats, agencyId,
    });

    // Notify the assigned driver
    const depTime = new Date(scheduledStart).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    notify(driverId, 'trip_assigned', 'New trip assigned', `You have been assigned to ${route.name} departing ${depTime}`, '/driver/dashboard').catch(() => {});

    return created(res, trip, 'Trip scheduled successfully');
  } catch (err) { next(err); }
};

// ── PATCH /api/trips/:id/start ───────────────────────────────────────
exports.startTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return notFound(res, 'Trip not found');
    if (!assertSameAgency(req, trip)) return forbidden(res, 'Access denied');
    if (trip.status !== 'scheduled') return badRequest(res, 'Only scheduled trips can be started');
    if (String(trip.driverId) !== String(req.user._id) && !isPlatformAdmin(req.user) && !['agencyAdmin', 'fleetManager'].includes(req.user.role)) {
      return forbidden(res, 'Only the assigned driver can start this trip');
    }

    trip.status = 'inProgress';
    trip.actualStart = new Date();
    await trip.save();

    await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: 'active', currentTrip: trip._id });

    return success(res, trip, 'Trip started. GPS broadcasting active.');
  } catch (err) { next(err); }
};

// ── PATCH /api/trips/:id/end ─────────────────────────────────────────
exports.endTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return notFound(res, 'Trip not found');
    if (!assertSameAgency(req, trip)) return forbidden(res, 'Access denied');
    if (trip.status !== 'inProgress') return badRequest(res, 'Trip is not in progress');

    trip.status = 'completed';
    trip.actualEnd = new Date();
    await trip.save();

    // Mark all upcoming bookings on this trip as completed
    const Booking = require('../models/Booking');
    await Booking.updateMany(
      { tripId: trip._id, status: 'upcoming' },
      { $set: { status: 'completed' } }
    );

    await Vehicle.findByIdAndUpdate(trip.vehicleId, {
      status: 'idle', currentTrip: null, currentDriver: null,
    });

    // Notify driver that trip is logged as complete
    notify(trip.driverId, 'trip_completed', 'Trip completed', `Your trip has been recorded as completed.`, '/driver/history').catch(() => {});

    return success(res, trip, 'Trip completed successfully');
  } catch (err) { next(err); }
};

// ── GET /api/trips/:id/seats ─────────────────────────────────────────
exports.getSeats = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).select('seats agencyId status');
    if (!trip) return notFound(res, 'Trip not found');

    // Release expired seat holds
    const now = new Date();
    let modified = false;
    trip.seats.forEach(seat => {
      if (seat.status === 'held' && seat.heldUntil && seat.heldUntil < now) {
        seat.status = 'available';
        seat.heldBy = null;
        seat.heldUntil = null;
        modified = true;
      }
    });
    if (modified) await trip.save();

    return success(res, { seats: trip.seats, tripStatus: trip.status });
  } catch (err) { next(err); }
};
