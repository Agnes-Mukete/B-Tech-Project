const Agency = require('../models/Agency');
const User = require('../models/User');
const AgencyRating = require('../models/AgencyRating');
const { success, created, notFound, badRequest, forbidden, paginate } = require('../utils/response');
const logger = require('../utils/logger');
const { isPlatformAdmin } = require('../middleware/rbac');
const { recordAudit } = require('../utils/audit');

// ── GET /api/agencies  (public – active + visible only) ──────────────
exports.listPublic = async (req, res, next) => {
  try {
    const { search, city, page = 1, limit = 20 } = req.query;
    const filter = { status: 'active' };

    if (search) filter.$text = { $search: search };
    if (city) filter.coverageCities = { $regex: city, $options: 'i' };

    const skip = (page - 1) * limit;
    const [agencies, total] = await Promise.all([
      Agency.find(filter)
        .sort({ tier: -1, rating: -1 })   // premium + highest-rated first
        .skip(skip)
        .limit(Number(limit))
        .select('-documents -ownerEmail -ownerPhone'),
      Agency.countDocuments(filter),
    ]);

    return paginate(res, agencies, page, limit, total, 'Agencies retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/agencies/admin  (admin only – all statuses) ─────────────
exports.listAdmin = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const skip = (page - 1) * limit;
    const [agencies, total] = await Promise.all([
      Agency.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Agency.countDocuments(filter),
    ]);

    return paginate(res, agencies, page, limit, total, 'Agencies retrieved');
  } catch (err) { next(err); }
};

// ── GET /api/agencies/stats  (admin) ─────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [active, pending, suspended] = await Promise.all([
      Agency.countDocuments({ status: 'active' }),
      Agency.countDocuments({ status: 'pending' }),
      Agency.countDocuments({ status: 'suspended' }),
    ]);
    return success(res, { active, pending, suspended, total: active + pending + suspended });
  } catch (err) { next(err); }
};

// ── POST /api/agencies  (admin or public self-registration) ──────────
exports.register = async (req, res, next) => {
  try {
    const { name, shortCode, logoColor, ownerName, ownerEmail, ownerPhone, city, coverageCities, amenities, tier } = req.body;

    const existing = await Agency.findOne({ ownerEmail });
    if (existing) return badRequest(res, 'An agency with this owner email already exists');

    const agency = await Agency.create({
      name, shortCode, logoColor, ownerName, ownerEmail, ownerPhone,
      city, coverageCities, amenities, tier,
      status: 'pending', visible: false,
    });

    logger.info(`Agency registered: ${name} (${agency._id})`);
    await recordAudit(req, {
      action: 'agency.registered',
      entityType: 'Agency',
      entityId: agency._id,
      agencyId: agency._id,
      metadata: { source: req.user ? 'admin' : 'public' },
    });
    return created(res, agency, 'Agency registration submitted. Awaiting administrator approval.');
  } catch (err) { next(err); }
};

// ── GET /api/agencies/:id ────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return notFound(res, 'Agency not found');

    // Non-admins only see active+visible agencies
    if (!isPlatformAdmin(req.user) && (agency.status !== 'active' || !agency.visible)) {
      return notFound(res, 'Agency not found');
    }

    return success(res, agency);
  } catch (err) { next(err); }
};

// ── PATCH /api/agencies/:id/status  (admin) ──────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return badRequest(res, 'Status must be active or suspended');
    }

    const agency = await Agency.findById(req.params.id);
    if (!agency) return notFound(res, 'Agency not found');

    const prevStatus = agency.status;
    agency.status = status;

    // Activating always makes the agency visible; suspending always hides it
    if (status === 'active')    agency.visible = true;
    if (status === 'suspended') agency.visible = false;

    await agency.save();
    logger.info(`Agency ${agency.name} status: ${prevStatus} → ${status}`);

    return success(res, agency, `Agency ${status === 'active' ? 'approved' : 'suspended'} successfully`);
  } catch (err) { next(err); }
};

// ── PATCH /api/agencies/:id/visibility  (admin) ──────────────────────
exports.toggleVisibility = async (req, res, next) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return notFound(res, 'Agency not found');
    if (agency.status !== 'active') {
      return badRequest(res, 'Only active agencies can have their visibility toggled');
    }

    agency.visible = !agency.visible;
    await agency.save();

    return success(res, { visible: agency.visible }, `Agency is now ${agency.visible ? 'visible' : 'hidden'} to passengers`);
  } catch (err) { next(err); }
};

// ── POST /api/agencies/:id/ratings  (authenticated passenger, post-trip) ──
exports.submitRating = async (req, res, next) => {
  try {
    const { bookingId, score, comment } = req.body;
    const agencyId = req.params.id;

    const Booking = require('../models/Booking');
    const booking = await Booking.findOne({
      _id: bookingId,
      passengerId: req.user._id,
      agencyId,
      status: 'completed',
    });
    if (!booking) return badRequest(res, 'Booking not found, not yours, or trip not yet completed');
    if (booking.ratedAt) return badRequest(res, 'You have already rated this booking');

    const rating = await AgencyRating.create({
      agencyId, passengerId: req.user._id,
      bookingId, tripId: booking.tripId, score, comment,
    });

    // Update booking to mark as rated
    booking.rating = score;
    booking.comment = comment;
    booking.ratedAt = new Date();
    await booking.save();

    // Recalculate aggregate agency rating
    const agg = await AgencyRating.aggregate([
      { $match: { agencyId: agency._id } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    if (agg.length) {
      await Agency.findByIdAndUpdate(agencyId, {
        rating: Math.round(agg[0].avg * 10) / 10,
        ratingCount: agg[0].count,
      });
    }

    return created(res, rating, 'Rating submitted. Thank you!');
  } catch (err) { next(err); }
};

// ── GET /api/agencies/:id/ratings  (public, paginated) ───────────────
exports.getRatings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const [ratings, total] = await Promise.all([
      AgencyRating.find({ agencyId: req.params.id })
        .populate('passengerId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AgencyRating.countDocuments({ agencyId: req.params.id }),
    ]);
    return paginate(res, ratings, page, limit, total);
  } catch (err) { next(err); }
};
