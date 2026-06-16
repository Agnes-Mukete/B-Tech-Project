require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const router = require('./routes/index');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const initGpsServer = require('./services/gpsServer');
const { startReminderCron } = require('./services/reminderService');
const logger = require('./utils/logger');
console.log('ENV FILE TEST');
console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('PORT =', process.env.PORT);
console.log('MONGODB_URI =', process.env.MONGODB_URI);

const app = express();
const server = http.createServer(app);

// ── Connect database ─────────────────────────────────────────────────
connectDB();

// ── Core middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Rate limiting ─────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 60000, max: 20, message: 'Too many auth requests' }));
app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0', ts: new Date() }));

// ── API routes ────────────────────────────────────────────────────────
app.use('/api', router);

// ── WebSocket GPS server ──────────────────────────────────────────────
initGpsServer(server);

// ── Departure reminder cron ───────────────────────────────────────────
startReminderCron();

// ── Error handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`MoveSmart API v1.0 running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = { app, server }; // exported for tests
