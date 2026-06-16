const GpsLog = require('../models/GpsLog');
const Trip = require('../models/Trip');
const { success, notFound, paginate } = require('../utils/response');
const { assertSameAgency } = require('../middleware/rbac');

// ── GET /api/gps/:tripId  – position history for a trip ───────────────
exports.getTripHistory = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).select('agencyId');
    if (!trip) return notFound(res, 'Trip not found');
    if (!assertSameAgency(req, trip)) return notFound(res, 'Trip not found');

    const { page = 1, limit = 500 } = req.query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      GpsLog.find({ tripId: req.params.tripId })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(Number(limit))
        .select('latitude longitude speed heading timestamp'),
      GpsLog.countDocuments({ tripId: req.params.tripId }),
    ]);

    return paginate(res, logs, page, limit, total, 'GPS history retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/gps/live/:agencyId  – latest position per active vehicle ─
exports.getLivePositions = async (req, res, next) => {
  try {
    const Vehicle = require('../models/Vehicle');
    const filter = { agencyId: req.params.agencyId, status: 'active' };

    // If passenger, only show agency's active vehicles
    const vehicles = await Vehicle.find(filter)
      .select('vehicleId lastPosition currentRoute currentTrip')
      .populate('currentRoute', 'name')
      .lean();

    return success(res, vehicles, 'Live positions retrieved');
  } catch (err) { next(err); }
};
