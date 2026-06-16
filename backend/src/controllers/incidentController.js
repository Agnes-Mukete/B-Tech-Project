const Incident = require('../models/Incident');
const { success, created, notFound, badRequest, paginate } = require('../utils/response');
const { assertSameAgency } = require('../middleware/rbac');

exports.submit = async (req, res, next) => {
  try {
    const { tripId, vehicleId, type, description, location } = req.body;
    const incident = await Incident.create({
      tripId, vehicleId, driverId: req.user._id,
      agencyId: req.user.agencyId,
      type, description, location, priority: 'high',
    });
    return created(res, incident, 'Incident reported. Fleet manager has been notified.');
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const filter = { ...req.agencyFilter };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .populate('driverId', 'name')
        .populate('vehicleId', 'vehicleId')
        .sort({ reportedAt: -1 })
        .skip(skip).limit(Number(limit)),
      Incident.countDocuments(filter),
    ]);
    return paginate(res, incidents, page, limit, total);
  } catch (err) { next(err); }
};

exports.resolve = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return notFound(res, 'Incident not found');
    if (!assertSameAgency(req, incident)) return notFound(res, 'Incident not found');
    if (incident.status === 'resolved') return badRequest(res, 'Incident already resolved');

    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.resolvedBy = req.user._id;
    incident.resolution = req.body.resolution || '';
    await incident.save();
    return success(res, incident, 'Incident marked as resolved');
  } catch (err) { next(err); }
};
