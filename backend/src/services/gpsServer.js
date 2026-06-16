const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const GpsLog = require('../models/GpsLog');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');

/**
 * Initialise the Socket.IO GPS server.
 * Drivers broadcast positions → passengers and fleet managers subscribe by agencyId/routeId.
 */
const initGpsServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Authentication middleware ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { id: userId, role, agencyId } = socket.user;
    logger.debug(`WS connected: ${userId} [${role}]`);

    // Driver: joins their agency's driver room and broadcasts GPS
    if (role === 'driver') {
      socket.join(`agency:${agencyId}:drivers`);

      socket.on('gps:broadcast', async (data) => {
        const { tripId, vehicleId, latitude, longitude, speed, heading } = data;

        // Persist log
        await GpsLog.create({ tripId, vehicleId, agencyId, latitude, longitude, speed, heading });

        // Update vehicle's cached position
        await Vehicle.findByIdAndUpdate(vehicleId, {
          'lastPosition.latitude':  latitude,
          'lastPosition.longitude': longitude,
          'lastPosition.speed':     speed,
          'lastPosition.heading':   heading,
          'lastPosition.updatedAt': new Date(),
        });

        // Broadcast to all subscribers of this agency
        io.to(`agency:${agencyId}:subscribers`).emit('gps:update', {
          vehicleId, tripId, latitude, longitude, speed, heading, ts: Date.now(),
        });
      });

      socket.on('gps:stop', () => {
        logger.debug(`GPS stopped: ${userId}`);
        socket.to(`agency:${agencyId}:drivers`).emit('gps:offline', { driverId: userId });
      });
    }

    // Fleet manager / passenger: subscribe to an agency's GPS feed
    if (['agencyAdmin', 'fleetManager', 'passenger', 'admin', 'superAdmin'].includes(role)) {
      const subAgency = socket.handshake.query?.agencyId || agencyId;
      socket.join(`agency:${subAgency}:subscribers`);
      logger.debug(`WS subscribed to agency ${subAgency}: ${userId}`);
    }

    socket.on('disconnect', () => {
      logger.debug(`WS disconnected: ${userId}`);
    });
  });

  return io;
};

module.exports = initGpsServer;
