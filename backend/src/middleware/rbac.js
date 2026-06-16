const { forbidden } = require('../utils/response');

const PLATFORM_ADMIN_ROLES = ['admin', 'superAdmin'];
const AGENCY_ADMIN_ROLES = ['agencyAdmin', 'fleetManager'];

const expandRoles = (roles) => {
  const expanded = new Set(roles);
  if (roles.includes('admin')) expanded.add('superAdmin');
  if (roles.includes('superAdmin')) expanded.add('admin');
  if (roles.includes('fleetManager')) expanded.add('agencyAdmin');
  if (roles.includes('agencyAdmin')) expanded.add('fleetManager');
  return [...expanded];
};

const isPlatformAdmin = (user) => PLATFORM_ADMIN_ROLES.includes(user?.role);
const isAgencyOperator = (user) => AGENCY_ADMIN_ROLES.includes(user?.role) || user?.role === 'driver';

/**
 * Role-based access control.
 * Usage: authorize('admin', 'fleetManager')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated');
  if (!expandRoles(roles).includes(req.user.role)) {
    return forbidden(res, `Role '${req.user.role}' is not permitted for this action`);
  }
  next();
};

/**
 * Agency-scope enforcement.
 * For fleetManager and driver roles, ensures the resource's agencyId
 * matches the calling user's agencyId.
 *
 * Admin bypasses — they have cross-agency access.
 *
 * Usage: scopeToAgency() after authenticate()
 * Requires the resolved resource to be at req.resource (set by controller).
 *
 * Alternatively, attach agencyId filter to req.agencyFilter for queries.
 */
const scopeToAgency = () => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated');

  // Platform admins can see everything
  if (isPlatformAdmin(req.user)) {
    req.agencyFilter = {};
    return next();
  }

  // agencyAdmin, fleetManager and driver are scoped to their own agency
  if (isAgencyOperator(req.user)) {
    if (!req.user.agencyId) {
      return forbidden(res, 'User is not associated with any agency');
    }
    req.agencyFilter = { agencyId: req.user.agencyId };
    return next();
  }

  // passengers: no agency filter applied here (they browse freely)
  req.agencyFilter = {};
  next();
};

/**
 * Verify a specific resource's agencyId matches the calling user's agencyId.
 * Call after loading the resource: assertSameAgency(req, resource)
 */
const assertSameAgency = (req, resource) => {
  if (isPlatformAdmin(req.user)) return true;
  if (!resource.agencyId) return false;
  return String(resource.agencyId) === String(req.user.agencyId);
};

module.exports = { authorize, scopeToAgency, assertSameAgency, isPlatformAdmin, isAgencyOperator };
