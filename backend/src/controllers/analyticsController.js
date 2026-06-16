const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Incident = require('../models/Incident');
const Agency = require('../models/Agency');
const { success } = require('../utils/response');
const { isPlatformAdmin } = require('../middleware/rbac');

// Helper: date range from query param
const getDateRange = (range) => {
  const now = new Date();
  const start = new Date();
  if (range === 'last7')  start.setDate(now.getDate() - 7);
  else if (range === 'last30') start.setDate(now.getDate() - 30);
  else start.setHours(0, 0, 0, 0); // today default
  return { $gte: start, $lte: now };
};

// ── GET /api/analytics/overview ──────────────────────────────────────
exports.overview = async (req, res, next) => {
  try {
    const agencyFilter = req.agencyFilter; // {} for admin, {agencyId} for fleet manager

    const [
      totalVehicles, activeTrips, driversOnDuty,
      passengersToday, activeAgencies,
    ] = await Promise.all([
      Vehicle.countDocuments(agencyFilter),
      Trip.countDocuments({ ...agencyFilter, status: 'inProgress' }),
      User.countDocuments({ ...agencyFilter, role: 'driver', status: 'active' }),
      Booking.countDocuments({
        ...agencyFilter,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: { $ne: 'cancelled' },
      }),
      // Only platform admins see cross-agency count
      isPlatformAdmin(req.user)
        ? Agency.countDocuments({ status: 'active', visible: true })
        : Promise.resolve(null),
    ]);

    const data = { totalVehicles, activeTrips, driversOnDuty, passengersToday };
    if (activeAgencies !== null) data.activeAgencies = activeAgencies;

    return success(res, data, 'Overview metrics retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/analytics/peak-hours ────────────────────────────────────
exports.peakHours = async (req, res, next) => {
  try {
    const dateRange = getDateRange(req.query.range);
    const agencyFilter = req.agencyFilter;

    const bookings = await Booking.aggregate([
      { $match: { ...agencyFilter, createdAt: dateRange, status: { $ne: 'cancelled' } } },
      { $group: { _id: { $hour: '$createdAt' }, bookings: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);

    const trips = await Trip.aggregate([
      { $match: { ...agencyFilter, scheduledStart: dateRange } },
      { $group: { _id: { $hour: '$scheduledStart' }, trips: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);

    // Merge into 24-hour array
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      bookings: bookings.find(b => b._id === h)?.bookings || 0,
      trips:    trips.find(t => t._id === h)?.trips    || 0,
    }));

    return success(res, hours, 'Peak hours data retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/analytics/vehicle-status ────────────────────────────────
exports.vehicleStatus = async (req, res, next) => {
  try {
    const agencyFilter = req.agencyFilter;
    const counts = await Vehicle.aggregate([
      { $match: agencyFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const total = counts.reduce((s, c) => s + c.count, 0);
    const result = { active: 0, idle: 0, maintenance: 0, total };
    counts.forEach(c => { result[c._id] = c.count; });

    return success(res, result, 'Vehicle status distribution retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/analytics/route-performance ─────────────────────────────
exports.routePerformance = async (req, res, next) => {
  try {
    const dateRange = getDateRange(req.query.range);
    const agencyFilter = req.agencyFilter;

    const trips = await Trip.find({
      ...agencyFilter,
      status: 'completed',
      scheduledStart: dateRange,
    }).populate('routeId', 'name origin destination');

    // Group by route
    const routeMap = {};
    trips.forEach(t => {
      if (!t.routeId) return;
      const id = String(t.routeId._id);
      if (!routeMap[id]) {
        routeMap[id] = {
          routeId: id,
          name: t.routeId.name,
          origin: t.routeId.origin,
          destination: t.routeId.destination,
          totalTrips: 0, onTimeTrips: 0,
          totalSeats: 0, bookedSeats: 0,
        };
      }
      const r = routeMap[id];
      r.totalTrips++;
      // On-time: actual end within 10 min of scheduled end
      if (t.actualEnd && t.scheduledEnd) {
        const diff = (t.actualEnd - t.scheduledEnd) / 60000;
        if (diff <= 10) r.onTimeTrips++;
      }
      r.totalSeats  += t.seats.length;
      r.bookedSeats += t.seats.filter(s => s.status === 'booked').length;
    });

    const result = Object.values(routeMap).map(r => ({
      ...r,
      onTimePct:   r.totalTrips ? Math.round((r.onTimeTrips / r.totalTrips)  * 100) : 0,
      occupancyPct: r.totalSeats ? Math.round((r.bookedSeats / r.totalSeats) * 100) : 0,
    }));

    return success(res, result, 'Route performance retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/analytics/driver-performance ────────────────────────────
exports.driverPerformance = async (req, res, next) => {
  try {
    const dateRange = getDateRange(req.query.range);
    const agencyFilter = req.agencyFilter;

    const trips = await Trip.find({
      ...agencyFilter,
      status: 'completed',
      scheduledStart: dateRange,
    }).populate('driverId', 'name');

    const incidents = await Incident.find({
      ...agencyFilter,
      reportedAt: dateRange,
    });

    const driverMap = {};
    trips.forEach(t => {
      if (!t.driverId) return;
      const id = String(t.driverId._id);
      if (!driverMap[id]) {
        driverMap[id] = { driverId: id, name: t.driverId.name, trips: 0, onTime: 0 };
      }
      driverMap[id].trips++;
      if (t.actualEnd && t.scheduledEnd) {
        if ((t.actualEnd - t.scheduledEnd) / 60000 <= 10) driverMap[id].onTime++;
      }
    });

    incidents.forEach(i => {
      const id = String(i.driverId);
      if (driverMap[id]) driverMap[id].incidents = (driverMap[id].incidents || 0) + 1;
    });

    const result = Object.values(driverMap).map(d => ({
      ...d,
      onTimePct: d.trips ? Math.round((d.onTime / d.trips) * 100) : 0,
      incidents: d.incidents || 0,
      // Score: weighted combo of on-time and incident-free rate
      score: d.trips
        ? Math.round(((d.onTime / d.trips) * 0.7 + Math.max(0, 1 - (d.incidents || 0) / d.trips) * 0.3) * 100)
        : 0,
    })).sort((a, b) => b.score - a.score);

    return success(res, result, 'Driver performance retrieved');
  } catch (err) { next(err); }
};
