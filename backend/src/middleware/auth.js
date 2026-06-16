const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { unauthorized } = require('../utils/response');

/**
 * Verify JWT access token.
 * Attaches req.user = { id, role, agencyId } on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Access token required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokenHash').lean();
    if (!user) return unauthorized(res, 'User not found');
    if (user.status === 'inactive') return unauthorized(res, 'Account deactivated');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Access token expired');
    if (err.name === 'JsonWebTokenError') return unauthorized(res, 'Invalid access token');
    next(err);
  }
};

/**
 * Optional auth — attaches req.user if token present, else continues.
 * Used for public routes that show more data when authenticated.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokenHash').lean();
    if (user && user.status === 'active') req.user = user;
  } catch (_) { /* silent — optional */ }
  next();
};

module.exports = { authenticate, optionalAuth };
