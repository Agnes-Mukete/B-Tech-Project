const Route = require('../models/Route');
const { success, created, notFound, badRequest, paginate } = require('../utils/response');
const { assertSameAgency, isPlatformAdmin } = require('../middleware/rbac');

// ── GET /api/routes ───────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { origin, destination, page = 1, limit = 20 } = req.query;
    const filter = { ...req.agencyFilter };
    if (origin)      filter.origin      = { $regex: origin,      $options: 'i' };
    if (destination) filter.destination = { $regex: destination, $options: 'i' };

    const skip = (page - 1) * limit;
    const [routes, total] = await Promise.all([
      Route.find(filter)
        .populate('agencyId', 'name shortCode logoColor')
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Route.countDocuments(filter),
    ]);
    return paginate(res, routes, page, limit, total, 'Routes retrieved');
  } catch (err) { next(err); }
};

// ── POST /api/routes ──────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const agencyId = isPlatformAdmin(req.user) ? req.body.agencyId : req.user.agencyId;
    if (!agencyId) return badRequest(res, 'agencyId required');

    const routeId = `R${Date.now()}`;
    const route = await Route.create({ ...req.body, routeId, agencyId });
    return created(res, route, 'Route created');
  } catch (err) { next(err); }
};

// ── GET /api/routes/:id ───────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('agencyId', 'name shortCode logoColor');
    if (!route) return notFound(res, 'Route not found');
    return success(res, route);
  } catch (err) { next(err); }
};

// ── PUT /api/routes/:id ───────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return notFound(res, 'Route not found');
    if (!assertSameAgency(req, route)) return notFound(res, 'Route not found');

    const allowed = ['name', 'stops', 'distanceKm', 'estimatedDuration', 'baseFare', 'isActive'];
    allowed.forEach(k => { if (req.body[k] !== undefined) route[k] = req.body[k]; });
    await route.save();
    return success(res, route, 'Route updated');
  } catch (err) { next(err); }
};
