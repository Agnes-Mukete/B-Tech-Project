/**
 * Lightweight notification helper — fire-and-forget.
 * Usage: notify(userId, 'trip_assigned', 'Trip Assigned', 'You have a new trip...', '/driver/dashboard')
 */
const Notification = require('../models/Notification');
const logger       = require('./logger');

async function notify(userId, type, title, message, link = null) {
  if (!userId) return;
  try {
    await Notification.create({ userId, type, title, message, link });
  } catch (err) {
    logger.error('notify() failed:', err.message);
  }
}

module.exports = notify;
