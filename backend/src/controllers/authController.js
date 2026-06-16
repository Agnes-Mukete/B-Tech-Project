const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');
const { success, created, badRequest, unauthorized } = require('../utils/response');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const signAccess = (user) =>
  jwt.sign({ id: user._id, role: user.role, agencyId: user.agencyId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });

const signRefresh = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return badRequest(res, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      role: 'passenger',
      agencyId: null,
    });

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    setRefreshCookie(res, refreshToken);
    return created(res, { accessToken, user: user.toSafeObject() }, 'Registration successful');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return badRequest(res, 'Identifier and password are required');

    // Detect whether the identifier is an email address or a staff ID
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

    let user;
    if (isEmail) {
      user = await User.findOne({ email: identifier.toLowerCase() });
      // Drivers and fleet managers must use their Staff ID — block email login for them
      if (user && ['driver', 'fleetManager'].includes(user.role)) {
        return unauthorized(res, 'Drivers and fleet managers must log in with their Staff ID, not an email address.');
      }
    } else {
      // Treat as staff ID
      user = await User.findOne({ staffId: identifier.toUpperCase() });
      // Admin / passenger accounts don't have a staffId
      if (user && !['driver', 'fleetManager'].includes(user.role)) {
        return unauthorized(res, 'Invalid credentials');
      }
    }

    if (!user) return unauthorized(res, 'Invalid credentials');

    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return unauthorized(res, `Account locked. Try again in ${remaining} minute(s).`);
    }

    const match = await user.comparePassword(password);
    if (!match) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= LOCK_THRESHOLD) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        logger.warn(`Account locked: ${user.email}`);
        // Send lockout alert email (FR-A04) — fire-and-forget
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        emailService.sendLockoutAlert(user, ip).catch(e => logger.error('Lockout email failed:', e));
      }

      await user.save();
      return unauthorized(res, 'Invalid credentials');
    }

    if (user.status === 'inactive') return unauthorized(res, 'Account deactivated');

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    logger.info(`Login: ${user.email} [${user.role}]`);
    setRefreshCookie(res, refreshToken);

    return success(res, { accessToken, user: user.toSafeObject() }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return unauthorized(res, 'Refresh token missing');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokenHash) {
      return unauthorized(res, 'Invalid refresh token');
    }

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) return unauthorized(res, 'Invalid refresh token');

    const newAccess = signAccess(user);
    const newRefresh = signRefresh(user);

    user.refreshTokenHash = await bcrypt.hash(newRefresh, 10);
    await user.save();

    setRefreshCookie(res, newRefresh);
    return success(res, { accessToken: newAccess }, 'Token refreshed');
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Refresh token expired');
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshTokenHash: 1 },
      });
    }

    res.clearCookie('refreshToken');
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return success(res, {}, 'If that email is registered, a reset link has been sent');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.passwordResetToken = await bcrypt.hash(resetToken, 10);
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    emailService.sendPasswordReset(user, resetToken).catch(e => logger.error('Reset email failed:', e));
    logger.info(`Password reset requested for ${email}`);

    return success(res, {}, 'If that email is registered, a reset link has been sent');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/google  — verify Google ID token, find-or-create passenger
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return badRequest(res, 'Google credential is required');

    // credential is an OAuth2 access token (from useGoogleLogin implicit flow)
    // Fetch the user's profile from Google's userinfo endpoint
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${credential}` },
    });
    const { email, name, sub: googleId } = googleRes.data;

    if (!email) return badRequest(res, 'Google account does not have an email address');

    // Find by googleId first, then fall back to email (links existing account)
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      // Link googleId if not yet linked
      if (!user.googleId) { user.googleId = googleId; }
    } else {
      // Create new passenger account
      user = new User({
        name,
        email: email.toLowerCase(),
        googleId,
        role: 'passenger',
        agencyId: null,
      });
    }

    if (user.status === 'inactive') return unauthorized(res, 'Account deactivated');

    user.lastLogin = new Date();
    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    logger.info(`Google login: ${user.email}`);
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, user: user.toSafeObject() }, 'Google login successful');
  } catch (err) {
    logger.error('Google auth error:', err.message);
    return unauthorized(res, 'Google authentication failed');
  }
};

// POST /api/auth/apple  — verify Apple id_token, find-or-create passenger
// Requires: APPLE_CLIENT_ID (Service ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in .env
exports.appleAuth = async (req, res, next) => {
  try {
    const { idToken, firstName, lastName, email: appleEmail } = req.body;
    if (!idToken) return badRequest(res, 'Apple id_token is required');

    // Decode JWT header to get the key ID
    const [headerB64] = idToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());

    // Fetch Apple's public keys
    const appleKeysRes = await fetch('https://appleid.apple.com/auth/keys');
    const { keys } = await appleKeysRes.json();
    const key = keys.find(k => k.kid === header.kid);
    if (!key) return unauthorized(res, 'Apple public key not found');

    // Verify the token
    const { createPublicKey } = require('crypto');
    const jwkToPem = (jwk) => createPublicKey({ key: jwk, format: 'jwk' });
    const publicKey = jwkToPem(key);
    const decoded = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com',
    });

    const { sub: appleId, email: tokenEmail } = decoded;
    const email = (appleEmail || tokenEmail || '').toLowerCase();
    if (!email) return badRequest(res, 'Could not retrieve email from Apple');

    let user = await User.findOne({ $or: [{ appleId }, { email }] });

    if (user) {
      if (!user.appleId) { user.appleId = appleId; }
    } else {
      const name = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
      user = new User({
        name,
        email,
        appleId,
        role: 'passenger',
        agencyId: null,
      });
    }

    if (user.status === 'inactive') return unauthorized(res, 'Account deactivated');

    user.lastLogin = new Date();
    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    logger.info(`Apple login: ${user.email}`);
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, user: user.toSafeObject() }, 'Apple login successful');
  } catch (err) {
    logger.error('Apple auth error:', err.message);
    return unauthorized(res, 'Apple authentication failed');
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) return badRequest(res, 'Invalid or expired reset token');

    const valid = await bcrypt.compare(token, user.passwordResetToken);
    if (!valid) return badRequest(res, 'Invalid or expired reset token');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = undefined;

    await user.save();

    return success(res, {}, 'Password reset successful. Please log in again.');
  } catch (err) {
    next(err);
  }
};