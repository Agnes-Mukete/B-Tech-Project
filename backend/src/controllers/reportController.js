/**
 * reportController.js
 * Implements FR-AD20 and FR-AD21: Report generation in PDF and CSV formats.
 * Supported report types: fleet-utilisation, driver-performance, revenue-summary,
 *                         fuel-consumption, maintenance-log
 */
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Incident = require('../models/Incident');
const { success, badRequest, notFound } = require('../utils/response');
const logger = require('../utils/logger');

const REPORT_DIR = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const REPORT_TYPES = ['fleet-utilisation', 'driver-performance', 'revenue-summary', 'fuel-consumption', 'maintenance-log'];

// ── Data fetch helpers ────────────────────────────────────────────────────

async function fetchFleetUtilisation(agencyFilter, dateRange) {
  const trips = await Trip.find({
    ...agencyFilter,
    status: 'completed',
    scheduledStart: dateRange,
  }).populate('vehicleId', 'vehicleId plateNumber type capacity')
    .populate('routeId', 'name');

  const vehicleMap = {};
  trips.forEach(t => {
    if (!t.vehicleId) return;
    const vid = String(t.vehicleId._id);
    if (!vehicleMap[vid]) {
      vehicleMap[vid] = {
        vehicleId: t.vehicleId.vehicleId,
        plate: t.vehicleId.plateNumber,
        type: t.vehicleId.type,
        capacity: t.vehicleId.capacity,
        trips: 0,
        passengers: 0,
        onTimeTrips: 0,
      };
    }
    vehicleMap[vid].trips++;
    vehicleMap[vid].passengers += t.passengerCount || 0;
    if (t.actualEnd && t.scheduledEnd && (t.actualEnd - t.scheduledEnd) / 60000 <= 10) {
      vehicleMap[vid].onTimeTrips++;
    }
  });

  return Object.values(vehicleMap).map(v => ({
    ...v,
    onTimePct: v.trips ? `${Math.round((v.onTimeTrips / v.trips) * 100)}%` : '0%',
    avgPassengers: v.trips ? Math.round(v.passengers / v.trips) : 0,
    utilisation: v.capacity && v.trips
      ? `${Math.round((v.passengers / (v.capacity * v.trips)) * 100)}%`
      : '0%',
  }));
}

async function fetchDriverPerformance(agencyFilter, dateRange) {
  const trips = await Trip.find({
    ...agencyFilter,
    status: 'completed',
    scheduledStart: dateRange,
  }).populate('driverId', 'name email');

  const incidents = await Incident.find({ ...agencyFilter, createdAt: dateRange });

  const driverMap = {};
  trips.forEach(t => {
    if (!t.driverId) return;
    const id = String(t.driverId._id);
    if (!driverMap[id]) {
      driverMap[id] = { name: t.driverId.name, email: t.driverId.email, trips: 0, onTime: 0, incidents: 0 };
    }
    driverMap[id].trips++;
    if (t.actualEnd && t.scheduledEnd && (t.actualEnd - t.scheduledEnd) / 60000 <= 10) {
      driverMap[id].onTime++;
    }
  });
  incidents.forEach(i => {
    const id = String(i.driverId);
    if (driverMap[id]) driverMap[id].incidents++;
  });

  return Object.values(driverMap).map(d => ({
    ...d,
    onTimePct: d.trips ? `${Math.round((d.onTime / d.trips) * 100)}%` : '0%',
    score: d.trips
      ? `${Math.round(((d.onTime / d.trips) * 0.7 + Math.max(0, 1 - d.incidents / d.trips) * 0.3) * 100)}%`
      : '0%',
  }));
}

async function fetchRevenueSummary(agencyFilter, dateRange) {
  const bookings = await Booking.find({
    ...agencyFilter,
    status: { $ne: 'cancelled' },
    createdAt: dateRange,
  }).populate({ path: 'tripId', populate: { path: 'routeId', select: 'name origin destination' } });

  const routeMap = {};
  bookings.forEach(b => {
    const route = b.tripId?.routeId;
    const key = route ? String(route._id) : 'unknown';
    if (!routeMap[key]) {
      routeMap[key] = {
        route: route ? `${route.origin} → ${route.destination}` : 'Unknown',
        bookings: 0, cancellations: 0, totalFare: 0,
      };
    }
    routeMap[key].bookings++;
    routeMap[key].totalFare += b.fareBreakdown?.total || 0;
  });

  const cancelled = await Booking.countDocuments({ ...agencyFilter, status: 'cancelled', createdAt: dateRange });

  const rows = Object.values(routeMap);
  const grandTotal = rows.reduce((s, r) => s + r.totalFare, 0);
  rows.push({ route: 'TOTAL', bookings: rows.reduce((s, r) => s + r.bookings, 0), cancellations: cancelled, totalFare: grandTotal });
  return rows;
}

async function fetchMaintenanceLog(agencyFilter, dateRange) {
  return Incident.find({ ...agencyFilter, createdAt: dateRange })
    .populate('vehicleId', 'vehicleId plateNumber')
    .populate('driverId', 'name')
    .populate('resolvedBy', 'name')
    .sort({ createdAt: -1 })
    .then(incidents => incidents.map(i => ({
      vehicle: i.vehicleId?.plateNumber || '—',
      vehicleId: i.vehicleId?.vehicleId || '—',
      type: i.type,
      priority: i.priority,
      description: i.description,
      reportedBy: i.driverId?.name || '—',
      reportedAt: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '—',
      status: i.status,
      resolvedBy: i.resolvedBy?.name || '—',
      resolvedAt: i.resolvedAt ? new Date(i.resolvedAt).toLocaleDateString() : '—',
    })));
}

async function fetchFuelConsumption(agencyFilter) {
  const vehicles = await Vehicle.find(agencyFilter).select('vehicleId plateNumber type fuelLevel');
  return vehicles.map(v => ({
    vehicleId: v.vehicleId,
    plate: v.plateNumber,
    type: v.type,
    currentFuelLevel: `${v.fuelLevel || 0}%`,
    fuelStatus: v.fuelLevel < 30 ? 'Low' : v.fuelLevel < 60 ? 'Medium' : 'Good',
  }));
}

// ── CSV builder ──────────────────────────────────────────────────────────

function toCSV(rows, headers) {
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h])).join(',')));
  return lines.join('\n');
}

// ── PDF builder ──────────────────────────────────────────────────────────

function toPDF(title, subtitle, rows, headers, columnLabels) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', d => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#0F4C81');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
      .text('MOVESMART', 50, 22);
    doc.fontSize(10).font('Helvetica')
      .text(subtitle, 50, 48);
    doc.fillColor('#333333');

    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F4C81')
      .text(title, 50, 100);
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 122);

    // Table
    const startY = 150;
    const colW = (doc.page.width - 100) / headers.length;
    let y = startY;

    // Table header row
    doc.rect(50, y, doc.page.width - 100, 20).fill('#0F4C81');
    headers.forEach((h, i) => {
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
        .text(columnLabels[i] || h, 54 + i * colW, y + 6, { width: colW - 4, ellipsis: true });
    });
    y += 20;

    // Data rows
    rows.forEach((row, ri) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
      if (ri % 2 === 0) doc.rect(50, y, doc.page.width - 100, 18).fill('#F0F7FF');
      headers.forEach((h, i) => {
        doc.fillColor('#333333').fontSize(8).font('Helvetica')
          .text(String(row[h] ?? ''), 54 + i * colW, y + 5, { width: colW - 4, ellipsis: true });
      });
      y += 18;
    });

    // Footer
    doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F8F9FA');
    doc.fillColor('#999999').fontSize(8).font('Helvetica')
      .text('MoveSmart — Confidential | Academic Use', 50, doc.page.height - 28);

    doc.end();
  });
}

// ── Report definitions ────────────────────────────────────────────────────

const REPORT_DEFS = {
  'fleet-utilisation': {
    title: 'Fleet Utilisation Report',
    fetch: fetchFleetUtilisation,
    headers: ['vehicleId', 'plate', 'type', 'capacity', 'trips', 'passengers', 'avgPassengers', 'utilisation', 'onTimePct'],
    labels: ['Vehicle ID', 'Plate', 'Type', 'Capacity', 'Trips', 'Passengers', 'Avg Pax', 'Utilisation', 'On-Time %'],
  },
  'driver-performance': {
    title: 'Driver Performance Report',
    fetch: fetchDriverPerformance,
    headers: ['name', 'email', 'trips', 'onTimePct', 'incidents', 'score'],
    labels: ['Driver', 'Email', 'Trips', 'On-Time %', 'Incidents', 'Score'],
  },
  'revenue-summary': {
    title: 'Revenue Summary Report',
    fetch: fetchRevenueSummary,
    headers: ['route', 'bookings', 'cancellations', 'totalFare'],
    labels: ['Route', 'Bookings', 'Cancellations', 'Total Fare (FCFA)'],
  },
  'maintenance-log': {
    title: 'Maintenance Log Report',
    fetch: fetchMaintenanceLog,
    headers: ['vehicle', 'vehicleId', 'type', 'priority', 'description', 'reportedBy', 'reportedAt', 'status', 'resolvedBy', 'resolvedAt'],
    labels: ['Plate', 'Vehicle ID', 'Type', 'Priority', 'Description', 'Reported By', 'Date', 'Status', 'Resolved By', 'Resolved At'],
  },
  'fuel-consumption': {
    title: 'Fuel Consumption Report',
    fetch: fetchFuelConsumption,
    headers: ['vehicleId', 'plate', 'type', 'currentFuelLevel', 'fuelStatus'],
    labels: ['Vehicle ID', 'Plate', 'Type', 'Fuel Level', 'Status'],
  },
};

// ── POST /api/reports/generate ────────────────────────────────────────────
exports.generate = async (req, res, next) => {
  try {
    const { type, format = 'csv', dateFrom, dateTo } = req.body;

    if (!REPORT_TYPES.includes(type)) {
      return badRequest(res, `Invalid report type. Valid types: ${REPORT_TYPES.join(', ')}`);
    }
    if (!['pdf', 'csv'].includes(format)) {
      return badRequest(res, 'Format must be pdf or csv');
    }

    const def = REPORT_DEFS[type];
    const agencyFilter = req.agencyFilter || {};

    const dateRange = {
      $gte: dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(new Date().getDate() - 30)),
      $lte: dateTo   ? new Date(dateTo)   : new Date(),
    };

    // Fetch data — fuel-consumption does not use dateRange
    const rows = type === 'fuel-consumption'
      ? await def.fetch(agencyFilter)
      : await def.fetch(agencyFilter, dateRange);

    const timestamp = Date.now();
    const filename = `report_${type}_${timestamp}.${format}`;
    const filepath = path.join(REPORT_DIR, filename);

    if (format === 'csv') {
      const csvContent = toCSV(rows, def.headers);
      fs.writeFileSync(filepath, csvContent, 'utf8');
    } else {
      const pdfBuffer = await toPDF(def.title, `Date range: ${dateRange.$gte.toLocaleDateString()} – ${dateRange.$lte.toLocaleDateString()}`, rows, def.headers, def.labels);
      fs.writeFileSync(filepath, pdfBuffer);
    }

    logger.info(`Report generated: ${filename} by ${req.user?.email}`);

    return success(res, {
      filename,
      type,
      format,
      rowCount: rows.length,
      downloadUrl: `/api/reports/download/${filename}`,
    }, `${def.title} generated with ${rows.length} records`);

  } catch (err) { next(err); }
};

// ── GET /api/reports/download/:filename ──────────────────────────────────
exports.download = async (req, res, next) => {
  try {
    const { filename } = req.params;

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return badRequest(res, 'Invalid filename');
    }

    const filepath = path.join(REPORT_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return notFound(res, 'Report file not found');
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.pdf'
      ? 'application/pdf'
      : 'text/csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (err) { next(err); }
};
