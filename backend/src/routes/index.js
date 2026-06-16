const express = require('express');
const router = express.Router();

// ── Controllers ───────────────────────────────────────────────────────
const authCtrl      = require('../controllers/authController');
const agencyCtrl    = require('../controllers/agencyController');
const userCtrl      = require('../controllers/userController');
const vehicleCtrl   = require('../controllers/vehicleController');
const routeCtrl     = require('../controllers/routeController');
const tripCtrl      = require('../controllers/tripController');
const bookingCtrl   = require('../controllers/bookingController');
const incidentCtrl  = require('../controllers/incidentController');
const analyticsCtrl = require('../controllers/analyticsController');
const gpsCtrl       = require('../controllers/gpsController');
const aiCtrl        = require('../controllers/aiController');
const reportCtrl    = require('../controllers/reportController');
const notifCtrl     = require('../controllers/notificationController');

// ── Middleware ────────────────────────────────────────────────────────
const { authenticate, optionalAuth }           = require('../middleware/auth');
const { authorize, scopeToAgency }             = require('../middleware/rbac');
const v = require('../middleware/validators');

// ── Inline agency-scoped trip search (for passenger flow) ─────────────
const Trip   = require('../models/Trip');
const Route  = require('../models/Route');
const { paginate } = require('../utils/response');


// ═══════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════
router.post('/auth/register',        v.registerRules, authCtrl.register);
router.post('/auth/login',           v.loginRules,    authCtrl.login);
router.post('/auth/refresh',                          authCtrl.refresh);
router.post('/auth/logout',          authenticate,    authCtrl.logout);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password',  authCtrl.resetPassword);
router.post('/auth/google',          authCtrl.googleAuth);
router.post('/auth/apple',           authCtrl.appleAuth);

// ═══════════════════════════════════════════════════════════════════════
//  AGENCIES
// ═══════════════════════════════════════════════════════════════════════

// Public – passenger directory (active + visible only)
router.get('/agencies',
  optionalAuth,
  agencyCtrl.listPublic);

// Admin – full listing with all statuses
router.get('/agencies/admin',
  authenticate, authorize('admin'),
  agencyCtrl.listAdmin);

// Admin – summary stats for dashboard cards
router.get('/agencies/stats',
  authenticate, authorize('admin'),
  agencyCtrl.getStats);

// Public / Admin – register a new agency (pending status)
router.post('/agencies',
  v.agencyRegisterRules,
  agencyCtrl.register);

// Public – single agency profile
router.get('/agencies/:id',
  optionalAuth,
  agencyCtrl.getOne);

// Admin – approve or suspend
router.patch('/agencies/:id/status',
  authenticate, authorize('admin'),
  agencyCtrl.updateStatus);

// Admin – toggle passenger visibility
router.patch('/agencies/:id/visibility',
  authenticate, authorize('admin'),
  agencyCtrl.toggleVisibility);

// Passenger – submit post-trip rating
router.post('/agencies/:id/ratings',
  authenticate, authorize('passenger'),
  agencyCtrl.submitRating);

// Public – paginated ratings list
router.get('/agencies/:id/ratings',
  agencyCtrl.getRatings);

// ── Agency-scoped trip search (passenger booking step 2) ─────────────
router.get('/agencies/:id/trips', optionalAuth, async (req, res, next) => {
  try {
    const { from, to, date, page = 1, limit = 20 } = req.query;

    // Verify agency is publicly accessible (active is enough — visible flag is optional)
    const Agency = require('../models/Agency');
    const agency = await Agency.findOne({ _id: req.params.id, status: 'active' });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const routeFilter = { agencyId: req.params.id, isActive: true };
    if (from) routeFilter.origin      = { $regex: from, $options: 'i' };
    if (to)   routeFilter.destination = { $regex: to,   $options: 'i' };

    const routes    = await Route.find(routeFilter);
    const routeIds  = routes.map(r => r._id);

    // If specific from/to were requested but no matching routes exist, return empty
    if ((from || to) && routeIds.length === 0) {
      return paginate(res, [], page, limit, 0, 'Trips retrieved');
    }

    const tripFilter = {
      agencyId: req.params.id,
      status:   'scheduled',
      // If routes were filtered, constrain to them; otherwise show all agency trips
      ...(routeIds.length > 0 ? { routeId: { $in: routeIds } } : {}),
    };

    if (date) {
      const day = new Date(date);
      tripFilter.scheduledStart = { $gte: day, $lt: new Date(day.getTime() + 86_400_000) };
    }

    const skip = (page - 1) * limit;
    const [trips, total] = await Promise.all([
      Trip.find(tripFilter)
        .populate('routeId', 'name origin destination stops distanceKm estimatedDuration baseFare')
        .populate('vehicleId', 'capacity type')
        .sort({ scheduledStart: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Trip.countDocuments(tripFilter),
    ]);

    const data = trips.map(t => {
      const available = t.seats.filter(s => s.status === 'available').length;
      const obj = t.toObject();
      delete obj.seats; // don't send full seat array here – use /trips/:id/seats
      return { ...obj, availableSeats: available };
    });

    return paginate(res, data, page, limit, total, 'Trips retrieved');
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════════════
router.get('/users/me',
  authenticate,
  userCtrl.getMe);

router.patch('/users/me',
  authenticate,
  userCtrl.updateMe);

router.get('/users',
  authenticate, authorize('admin', 'agencyAdmin', 'fleetManager'),
  userCtrl.list);

router.post('/users',
  authenticate, authorize('admin', 'agencyAdmin'),
  userCtrl.create);

router.get('/users/:id',
  authenticate, authorize('admin', 'agencyAdmin', 'fleetManager'),
  userCtrl.getOne);

router.put('/users/:id',
  authenticate, authorize('admin', 'agencyAdmin'),
  userCtrl.update);

router.patch('/users/:id/status',
  authenticate, authorize('admin', 'agencyAdmin'),
  userCtrl.updateStatus);

// ═══════════════════════════════════════════════════════════════════════
//  VEHICLES
// ═══════════════════════════════════════════════════════════════════════
router.get('/vehicles',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  vehicleCtrl.list);

router.post('/vehicles',
  authenticate, authorize('admin', 'fleetManager'),
  v.vehicleRules,
  vehicleCtrl.create);

router.get('/vehicles/:id',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  vehicleCtrl.getOne);

router.put('/vehicles/:id',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  vehicleCtrl.update);

router.patch('/vehicles/:id/status',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  vehicleCtrl.updateStatus);

// ═══════════════════════════════════════════════════════════════════════
//  ROUTES  (transport routes, not Express routes)
// ═══════════════════════════════════════════════════════════════════════
router.get('/routes',
  authenticate,
  scopeToAgency(),
  routeCtrl.list);

router.post('/routes',
  authenticate, authorize('admin', 'fleetManager'),
  v.routeRules,
  routeCtrl.create);

router.get('/routes/:id',
  authenticate,
  routeCtrl.getOne);

router.put('/routes/:id',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  routeCtrl.update);

// ═══════════════════════════════════════════════════════════════════════
//  TRIPS
// ═══════════════════════════════════════════════════════════════════════
router.get('/trips',
  authenticate, authorize('admin', 'fleetManager', 'driver'),
  scopeToAgency(),
  tripCtrl.list);

router.post('/trips',
  authenticate, authorize('admin', 'fleetManager'),
  v.tripRules,
  tripCtrl.create);

router.patch('/trips/:id/start',
  authenticate, authorize('admin', 'fleetManager', 'driver'),
  tripCtrl.startTrip);

router.patch('/trips/:id/end',
  authenticate, authorize('admin', 'fleetManager', 'driver'),
  tripCtrl.endTrip);

router.get('/trips/:id/seats',
  authenticate,
  tripCtrl.getSeats);

// ═══════════════════════════════════════════════════════════════════════
//  BOOKINGS
// ═══════════════════════════════════════════════════════════════════════
router.get('/bookings/my',
  authenticate, authorize('passenger'),
  bookingCtrl.myBookings);

router.post('/bookings',
  authenticate, authorize('passenger'),
  v.bookingRules,
  bookingCtrl.create);

router.get('/bookings/:id',
  authenticate,
  bookingCtrl.getOne);

router.delete('/bookings/:id',
  authenticate, authorize('passenger'),
  bookingCtrl.cancel);

// ═══════════════════════════════════════════════════════════════════════
//  INCIDENTS
// ═══════════════════════════════════════════════════════════════════════
router.post('/incidents',
  authenticate, authorize('driver'),
  v.incidentRules,
  incidentCtrl.submit);

router.get('/incidents',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  incidentCtrl.list);

router.patch('/incidents/:id/resolve',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  incidentCtrl.resolve);

// ═══════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════
router.get('/analytics/overview',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  analyticsCtrl.overview);

router.get('/analytics/peak-hours',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  analyticsCtrl.peakHours);

router.get('/analytics/vehicle-status',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  analyticsCtrl.vehicleStatus);

router.get('/analytics/route-performance',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  analyticsCtrl.routePerformance);

router.get('/analytics/driver-performance',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  analyticsCtrl.driverPerformance);

router.post('/ai/fleet-chat',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  aiCtrl.fleetChat);

// ═══════════════════════════════════════════════════════════════════════
//  REPORTS  (FR-AD20, FR-AD21)
// ═══════════════════════════════════════════════════════════════════════
router.post('/reports/generate',
  authenticate, authorize('admin', 'fleetManager'),
  scopeToAgency(),
  reportCtrl.generate);

router.get('/reports/download/:filename',
  authenticate, authorize('admin', 'fleetManager'),
  reportCtrl.download);

// ═══════════════════════════════════════════════════════════════════════
//  GPS
// ═══════════════════════════════════════════════════════════════════════
router.get('/gps/live/:agencyId',
  authenticate,
  gpsCtrl.getLivePositions);

router.get('/gps/:tripId',
  authenticate, authorize('admin', 'fleetManager', 'driver'),
  scopeToAgency(),
  gpsCtrl.getTripHistory);

// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
router.get('/notifications',
  authenticate,
  notifCtrl.list);

router.get('/notifications/unread-count',
  authenticate,
  notifCtrl.unreadCount);

router.patch('/notifications/read-all',
  authenticate,
  notifCtrl.markAllRead);

router.patch('/notifications/:id/read',
  authenticate,
  notifCtrl.markRead);

router.delete('/notifications/:id',
  authenticate,
  notifCtrl.remove);

module.exports = router;
