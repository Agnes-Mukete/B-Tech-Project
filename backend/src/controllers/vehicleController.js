const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const { success, created, notFound, badRequest, paginate } = require('../utils/response');
const { assertSameAgency, isPlatformAdmin } = require('../middleware/rbac');

exports.list = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { ...req.agencyFilter };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('currentDriver', 'name')
        .populate('currentRoute', 'name')
        .sort({ vehicleId: 1 })
        .skip(skip).limit(Number(limit)),
      Vehicle.countDocuments(filter),
    ]);
    return paginate(res, vehicles, page, limit, total);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const agencyId = isPlatformAdmin(req.user) ? req.body.agencyId : req.user.agencyId;
    const payload = {
      vehicleId: req.body.vehicleId,
      plateNumber: req.body.plateNumber,
      type: req.body.type,
      capacity: req.body.capacity,
      fuelLevel: req.body.fuelLevel,
      currentDriver: req.body.currentDriver || null,
      agencyId,
    };

    if (payload.currentDriver) {
      const driver = await User.findOne({ _id: payload.currentDriver, role: 'driver', agencyId });
      if (!driver) return badRequest(res, 'Selected driver does not belong to this agency');
    }

    const vehicle = await Vehicle.create(payload);
    return created(res, vehicle, 'Vehicle added to fleet');
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('currentDriver', 'name').populate('currentRoute', 'name');
    if (!vehicle) return notFound(res, 'Vehicle not found');
    if (!assertSameAgency(req, vehicle)) return notFound(res, 'Vehicle not found');
    return success(res, vehicle);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return notFound(res, 'Vehicle not found');
    if (!assertSameAgency(req, vehicle)) return notFound(res, 'Vehicle not found');

    if (req.body.currentDriver) {
      const driver = await User.findOne({ _id: req.body.currentDriver, role: 'driver', agencyId: vehicle.agencyId });
      if (!driver) return badRequest(res, 'Selected driver does not belong to this agency');
    }

    const allowed = ['type', 'capacity', 'fuelLevel', 'plateNumber', 'currentDriver'];
    allowed.forEach(k => { if (req.body[k] !== undefined) vehicle[k] = req.body[k]; });
    await vehicle.save();
    return success(res, vehicle, 'Vehicle updated');
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'idle', 'maintenance'].includes(status)) {
      return badRequest(res, 'Invalid status');
    }
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return notFound(res, 'Vehicle not found');
    if (!assertSameAgency(req, vehicle)) return notFound(res, 'Vehicle not found');

    vehicle.status = status;
    await vehicle.save();
    return success(res, vehicle, `Vehicle status updated to ${status}`);
  } catch (err) { next(err); }
};
