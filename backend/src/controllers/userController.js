const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Agency = require('../models/Agency');
const { success, created, notFound, badRequest, forbidden, paginate } = require('../utils/response');
const { isPlatformAdmin } = require('../middleware/rbac');
const { recordAudit } = require('../utils/audit');

// Generate a unique staff ID: {SHORTCODE}-{DRV|FLM}-{3-digit-seq}
async function generateStaffId(agencyId, role) {
  const agency = await Agency.findById(agencyId).select('shortCode');
  if (!agency) throw new Error('Agency not found when generating staff ID');
  const prefix = role === 'driver' ? 'DRV' : 'FLM';
  const count = await User.countDocuments({ agencyId, role });
  const seq = String(count + 1).padStart(3, '0');
  return `${agency.shortCode}-${prefix}-${seq}`;
}

// ── GET /api/users ────────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { role, status, agencyId, page = 1, limit = 20, search } = req.query;
    const filter = {};

    // Agency-level users only see their own agency's users
    if (['agencyAdmin', 'fleetManager'].includes(req.user.role)) filter.agencyId = req.user.agencyId;
    else if (agencyId) filter.agencyId = agencyId;

    if (role)   filter.role   = role;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -refreshTokenHash')
        .populate('agencyId', 'name shortCode')
        .sort({ createdAt: -1 })
        .skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);
    return paginate(res, users, page, limit, total, 'Users retrieved');
  } catch (err) { next(err); }
};

// ── POST /api/users  (admin creates any user) ─────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, agencyId } = req.body;
    const platformAdmin = isPlatformAdmin(req.user);
    const targetRole = role || 'passenger';
    const allowedAgencyRoles = ['fleetManager', 'driver', 'passenger'];

    if (!platformAdmin && req.user.role !== 'agencyAdmin') {
      return forbidden(res, 'Only platform admins and agency admins can create users');
    }

    if (req.user.role === 'agencyAdmin' && !allowedAgencyRoles.includes(targetRole)) {
      return forbidden(res, 'Agency admins can only create fleet managers, drivers and passengers');
    }

    const finalAgencyId = platformAdmin ? agencyId : req.user.agencyId;

    if (['agencyAdmin', 'fleetManager', 'driver'].includes(targetRole) && !finalAgencyId) {
      return badRequest(res, 'agencyId is required for agencyAdmin, fleetManager and driver roles');
    }

    const exists = await User.findOne({ email });
    if (exists) return badRequest(res, 'Email already registered');

    const passwordHash = await bcrypt.hash(password || 'ChangeMeNow123!', 12);

    // Auto-generate staffId for drivers and fleet managers
    let staffId;
    if (['driver', 'fleetManager'].includes(targetRole) && finalAgencyId) {
      staffId = await generateStaffId(finalAgencyId, targetRole);
    }

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: targetRole,
      phone,
      agencyId: finalAgencyId || null,
      ...(staffId && { staffId }),
    });
    await recordAudit(req, {
      action: 'user.created',
      entityType: 'User',
      entityId: user._id,
      agencyId: user.agencyId,
      metadata: { role: user.role },
    });
    return created(res, user.toSafeObject(), 'User created');
  } catch (err) { next(err); }
};

// ── GET /api/users/:id ────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -refreshTokenHash')
      .populate('agencyId', 'name shortCode');
    if (!user) return notFound(res, 'User not found');
    if (!isPlatformAdmin(req.user) && String(user.agencyId?._id || user.agencyId) !== String(req.user.agencyId)) {
      return notFound(res, 'User not found');
    }
    return success(res, user);
  } catch (err) { next(err); }
};

// ── PUT /api/users/:id ────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'User not found');
    if (!isPlatformAdmin(req.user) && String(user.agencyId) !== String(req.user.agencyId)) {
      return notFound(res, 'User not found');
    }

    const allowed = ['name', 'phone', 'agencyId'];
    // Only platform admins can change role and agency assignment
    if (isPlatformAdmin(req.user) && req.body.role) allowed.push('role');
    if (!isPlatformAdmin(req.user)) allowed.splice(allowed.indexOf('agencyId'), 1);

    allowed.forEach(k => { if (req.body[k] !== undefined) user[k] = req.body[k]; });
    await user.save();
    await recordAudit(req, {
      action: 'user.updated',
      entityType: 'User',
      entityId: user._id,
      agencyId: user.agencyId,
    });
    return success(res, user.toSafeObject(), 'User updated');
  } catch (err) { next(err); }
};

// ── PATCH /api/users/:id/status  (activate / deactivate) ─────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return badRequest(res, 'Status must be active or inactive');
    }
    const user = await User.findById(req.params.id).select('-passwordHash -refreshTokenHash');
    if (!user) return notFound(res, 'User not found');
    if (!isPlatformAdmin(req.user) && String(user.agencyId) !== String(req.user.agencyId)) {
      return notFound(res, 'User not found');
    }
    user.status = status;
    await user.save();
    await recordAudit(req, {
      action: `user.${status}`,
      entityType: 'User',
      entityId: user._id,
      agencyId: user.agencyId,
    });
    return success(res, user, `User ${status === 'active' ? 'activated' : 'deactivated'}`);
  } catch (err) { next(err); }
};

// ── GET /api/users/me  (own profile) ─────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash -refreshTokenHash')
      .populate('agencyId', 'name shortCode logoColor');
    if (!user) return notFound(res, 'User not found');
    return success(res, user);
  } catch (err) { next(err); }
};

// ── PATCH /api/users/me  (self profile update) ───────────────────────
exports.updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return notFound(res, 'User not found');

    const { name, phone, currentPassword, newPassword } = req.body;

    if (name)  user.name  = name.trim();
    if (phone !== undefined) user.phone = phone.trim();

    // Password change — requires currentPassword for verification
    if (newPassword) {
      if (!currentPassword) return badRequest(res, 'Current password is required to set a new password');
      const match = await user.comparePassword(currentPassword);
      if (!match) return badRequest(res, 'Current password is incorrect');
      if (newPassword.length < 8) return badRequest(res, 'New password must be at least 8 characters');
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.refreshTokenHash = undefined; // invalidate other sessions
    }

    await user.save();
    return success(res, user.toSafeObject(), 'Profile updated');
  } catch (err) { next(err); }
};
