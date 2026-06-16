const { body, validationResult } = require('express-validator');

// Run validation and return 400 on failure
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }

  next();
};

// Auth validators
exports.registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  body('role')
    .optional()
    .equals('passenger')
    .withMessage('Public registration is only allowed for passengers'),

  validate,
];

exports.loginRules = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or Staff ID is required'),

  body('password')
    .notEmpty()
    .withMessage('Password required'),

  validate,
];

// Agency validators
exports.agencyRegisterRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Agency name required'),

  body('shortCode')
    .trim()
    .notEmpty()
    .isLength({ max: 4 })
    .withMessage('Short code max 4 chars'),

  body('ownerName')
    .trim()
    .notEmpty()
    .withMessage('Owner name required'),

  body('ownerEmail')
    .isEmail()
    .withMessage('Valid owner email required'),

  body('ownerPhone')
    .trim()
    .notEmpty()
    .withMessage('Owner phone required'),

  body('city')
    .trim()
    .notEmpty()
    .withMessage('City required'),

  body('tier')
    .optional()
    .isIn(['standard', 'premium'])
    .withMessage('Tier must be standard or premium'),

  validate,
];

// Vehicle validators
exports.vehicleRules = [
  body('vehicleId')
    .trim()
    .notEmpty()
    .withMessage('Vehicle ID required'),

  body('plateNumber')
    .trim()
    .notEmpty()
    .withMessage('Plate number required'),

  body('type')
    .isIn(['bus', 'minibus', 'van'])
    .withMessage('Invalid vehicle type'),

  body('capacity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be 1-100'),

  body('currentDriver')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Valid driver required'),

  validate,
];

// Trip validators
exports.tripRules = [
  body('routeId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid routeId required'),

  body('vehicleId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid vehicleId required'),

  body('driverId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid driverId required'),

  body('scheduledStart')
    .isISO8601()
    .withMessage('Valid scheduledStart date required'),

  body('scheduledEnd')
    .isISO8601()
    .withMessage('Valid scheduledEnd date required'),

  validate,
];

// Booking validators
exports.bookingRules = [
  body('tripId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid tripId required'),

  body('seatLabel')
    .trim()
    .notEmpty()
    .withMessage('seatLabel required'),

  validate,
];

// Route validators
exports.routeRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Route name required'),

  body('origin')
    .trim()
    .notEmpty()
    .withMessage('Origin required'),

  body('destination')
    .trim()
    .notEmpty()
    .withMessage('Destination required'),

  body('distanceKm')
    .isFloat({ min: 0.1 })
    .withMessage('distanceKm required'),

  body('estimatedDuration')
    .isInt({ min: 1 })
    .withMessage('estimatedDuration (minutes) required'),

  body('baseFare')
    .isFloat({ min: 0 })
    .withMessage('baseFare required'),

  validate,
];

// Incident validators
exports.incidentRules = [
  body('tripId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid tripId required'),

  body('vehicleId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid vehicleId required'),

  body('type')
    .isIn(['mechanical', 'accident', 'passenger', 'route', 'other'])
    .withMessage('Invalid incident type'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description required'),

  validate,
];
