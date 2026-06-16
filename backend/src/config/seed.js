/**
 * MoveSmart v2.0 — Database Seeder
 * Run: node src/config/seed.js
 * Drops existing data and inserts realistic Cameroonian transport data.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const Agency       = require('../models/Agency');
const User         = require('../models/User');
const Vehicle      = require('../models/Vehicle');
const Route        = require('../models/Route');
const Trip         = require('../models/Trip');
const Booking      = require('../models/Booking');
const Incident     = require('../models/Incident');

const log = (msg) => console.log(`[SEED] ${msg}`);

// ── Helpers ───────────────────────────────────────────────────────────
const hash = (pw) => bcrypt.hash(pw, 12);

const future = (hoursFromNow) => {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
};

const generateSeats = (capacity) => {
  const seats = [];
  const rows = 'ABCDEFGHIJ';
  const cols = 4;
  let count = 0;
  for (let r = 0; r < rows.length && count < capacity; r++) {
    for (let c = 1; c <= cols && count < capacity; c++) {
      seats.push({ label: `${rows[r]}${c}`, status: 'available' });
      count++;
    }
  }
  return seats;
};

// ═══════════════════════════════════════════════════════════════════════
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/movesmart');
  log('Connected to MongoDB');

  // ── Drop all collections ─────────────────────────────────────────
  const collections = [Agency, User, Vehicle, Route, Trip, Booking, Incident];
  for (const model of collections) {
    await model.deleteMany({});
    log(`Cleared ${model.modelName}`);
  }

  // ── 1. Agencies ──────────────────────────────────────────────────
  const [mudian, golden, nso, voyage] = await Agency.insertMany([
    {
      name: 'Mudian Voyages', shortCode: 'MV', logoColor: '#1565C0',
      ownerName: 'Pierre Nkou', ownerEmail: 'admin@mudian.cm', ownerPhone: '+237677001122',
      city: 'Yaoundé', coverageCities: ['Yaoundé', 'Bafoussam', 'Douala', 'Bamenda'],
      amenities: ['ac', 'wifi'], tier: 'premium',
      status: 'active', visible: true, rating: 4.6, monthlyTrips: 142,
    },
    {
      name: 'Golden Voyages', shortCode: 'GV', logoColor: '#E65100',
      ownerName: 'Marie Tchamba', ownerEmail: 'info@golden.cm', ownerPhone: '+237699223445',
      city: 'Douala', coverageCities: ['Yaoundé', 'Bafoussam', 'Douala', 'Foumban'],
      amenities: ['ac'], tier: 'standard',
      status: 'active', visible: true, rating: 4.4, monthlyTrips: 218,
    },
    {
      name: 'Nso Boys Transport', shortCode: 'NB', logoColor: '#2E7D32',
      ownerName: 'Celestin Fombo', ownerEmail: 'nsoboys@gmail.com', ownerPhone: '+237651334556',
      city: 'Kumbo', coverageCities: ['Yaoundé', 'Kumbo', 'Bamenda', 'Bafoussam'],
      amenities: [], tier: 'standard',
      status: 'active', visible: true, rating: 4.1, monthlyTrips: 305,
    },
    {
      name: 'Trans Cameroun', shortCode: 'TC', logoColor: '#37474F',
      ownerName: 'Albert Fouda', ownerEmail: 'transcam@yahoo.fr', ownerPhone: '+237677778990',
      city: 'Bertoua', coverageCities: ['Yaoundé', 'Bertoua', 'Ngaoundéré'],
      amenities: ['ac'], tier: 'standard',
      status: 'pending', visible: false, rating: 0, monthlyTrips: 0,
    },
  ]);
  log(`Created ${4} agencies (3 active, 1 pending)`);

  // ── 2. Users ─────────────────────────────────────────────────────
  const pw = await hash('password123');

  const admin = await User.create({
    name: 'System Admin', email: 'admin@movesmart.cm',
    passwordHash: pw, role: 'admin', status: 'active',
  });

  // Mudian staff
  const [mudianFM, driver1, driver2] = await User.insertMany([
    { name: 'Amara Ngo',   email: 'amara@mudian.cm',  passwordHash: pw, role: 'fleetManager', agencyId: mudian._id },
    { name: 'Jean Mballa', email: 'jean@mudian.cm',   passwordHash: pw, role: 'driver',       agencyId: mudian._id },
    { name: 'Paul Essam',  email: 'paul@mudian.cm',   passwordHash: pw, role: 'driver',       agencyId: mudian._id },
  ]);

  // Golden staff
  const [goldenFM, driver3] = await User.insertMany([
    { name: 'Sylvie Kom', email: 'sylvie@golden.cm', passwordHash: pw, role: 'fleetManager', agencyId: golden._id },
    { name: 'Isa Fouda',  email: 'isa@golden.cm',    passwordHash: pw, role: 'driver',       agencyId: golden._id },
  ]);

  // Passengers
  const [pax1, pax2] = await User.insertMany([
    { name: 'Carine Tabe',   email: 'carine@gmail.com', passwordHash: pw, role: 'passenger' },
    { name: 'Roger Ateba',   email: 'roger@gmail.com',  passwordHash: pw, role: 'passenger' },
  ]);

  log(`Created ${7} users`);

  // ── 3. Vehicles ──────────────────────────────────────────────────
  const [v1, v2, v3, v4] = await Vehicle.insertMany([
    { vehicleId: 'V01', plateNumber: 'LT-001-YA', type: 'bus',     capacity: 40, status: 'active', fuelLevel: 82,  agencyId: mudian._id },
    { vehicleId: 'V02', plateNumber: 'LT-002-YA', type: 'bus',     capacity: 40, status: 'idle',   fuelLevel: 55,  agencyId: mudian._id },
    { vehicleId: 'V03', plateNumber: 'LT-003-YA', type: 'minibus', capacity: 20, status: 'active', fuelLevel: 38,  agencyId: mudian._id },
    { vehicleId: 'G01', plateNumber: 'LT-101-DL', type: 'bus',     capacity: 35, status: 'idle',   fuelLevel: 91,  agencyId: golden._id },
  ]);
  log(`Created ${4} vehicles`);

  // ── 4. Routes ────────────────────────────────────────────────────
  const [r1, r2, r3] = await Route.insertMany([
    {
      routeId: 'R-MV-01', name: 'Yaounde – Bafoussam',
      origin: 'Yaounde', destination: 'Bafoussam',
      stops: [
        { name: 'Yaoundé Mvan',          order: 1, arrivalOffset: 0   },
        { name: 'Bafia',                  order: 2, arrivalOffset: 90  },
        { name: 'Bafoussam Marché Central', order: 3, arrivalOffset: 255 },
      ],
      distanceKm: 293, estimatedDuration: 255, baseFare: 3500,
      isActive: true, agencyId: mudian._id,
    },
    {
      routeId: 'R-MV-02', name: 'Yaounde – Douala',
      origin: 'Yaounde', destination: 'Douala',
      stops: [
        { name: 'Yaoundé Nsam',  order: 1, arrivalOffset: 0   },
        { name: 'Edéa',          order: 2, arrivalOffset: 120 },
        { name: 'Douala Akwa',   order: 3, arrivalOffset: 225 },
      ],
      distanceKm: 240, estimatedDuration: 225, baseFare: 3000,
      isActive: true, agencyId: mudian._id,
    },
    {
      routeId: 'R-GV-01', name: 'Yaounde – Bafoussam',
      origin: 'Yaounde', destination: 'Bafoussam',
      stops: [
        { name: 'Yaoundé Nsam',           order: 1, arrivalOffset: 0   },
        { name: 'Tonga',                  order: 2, arrivalOffset: 100 },
        { name: 'Bafoussam Total',        order: 3, arrivalOffset: 270 },
      ],
      distanceKm: 293, estimatedDuration: 270, baseFare: 4000,
      isActive: true, agencyId: golden._id,
    },
  ]);
  log(`Created ${3} routes`);

  // ── 5. Trips ─────────────────────────────────────────────────────
  const trip1 = await Trip.create({
    tripId: 'T-001', routeId: r1._id, vehicleId: v1._id, driverId: driver1._id,
    scheduledStart: future(1), scheduledEnd: future(5.5),
    fare: 3500, status: 'scheduled',
    seats: generateSeats(40),
    agencyId: mudian._id,
  });

  const trip2 = await Trip.create({
    tripId: 'T-002', routeId: r1._id, vehicleId: v2._id, driverId: driver2._id,
    scheduledStart: future(3), scheduledEnd: future(7.5),
    fare: 3500, status: 'scheduled',
    seats: generateSeats(40),
    agencyId: mudian._id,
  });

  const trip3 = await Trip.create({
    tripId: 'T-003', routeId: r2._id, vehicleId: v3._id, driverId: driver1._id,
    scheduledStart: future(-3), scheduledEnd: future(1),
    fare: 3000, status: 'inProgress', actualStart: future(-3),
    seats: generateSeats(20),
    agencyId: mudian._id,
  });

  const trip4 = await Trip.create({
    tripId: 'T-004', routeId: r3._id, vehicleId: v4._id, driverId: driver3._id,
    scheduledStart: future(2), scheduledEnd: future(6.5),
    fare: 4000, status: 'scheduled',
    seats: generateSeats(35),
    agencyId: golden._id,
  });

  log(`Created ${4} trips`);

  // ── 6. Bookings ──────────────────────────────────────────────────
  // Book seat A1 on trip1 for pax1
  trip1.seats[0].status = 'booked';
  trip1.seats[0].bookingId = new mongoose.Types.ObjectId();
  trip1.passengerCount = 1;
  await trip1.save();

  const booking1 = await Booking.create({
    passengerId: pax1._id, tripId: trip1._id, seatLabel: 'A1',
    fareBreakdown: { baseFare: 3500, bookingFee: 100, total: 3600 },
    paymentId: 'PAY-TEST-001', paymentMethod: 'card',
    paidAt: new Date(), cardLast4: '4242', cardType: 'Visa',
    status: 'upcoming', agencyId: mudian._id,
  });

  // Book seat B1 on trip1 for pax2
  trip1.seats[4].status = 'booked';
  trip1.seats[4].bookingId = new mongoose.Types.ObjectId();
  trip1.passengerCount = 2;
  await trip1.save();

  const booking2 = await Booking.create({
    passengerId: pax2._id, tripId: trip1._id, seatLabel: 'B1',
    fareBreakdown: { baseFare: 3500, bookingFee: 100, total: 3600 },
    paymentId: 'PAY-TEST-002', paymentMethod: 'card',
    paidAt: new Date(), cardLast4: '1234', cardType: 'Mastercard',
    status: 'upcoming', agencyId: mudian._id,
  });

  log(`Created ${2} bookings`);

  // ── 7. Incident ──────────────────────────────────────────────────
  await Incident.create({
    tripId: trip3._id, driverId: driver1._id, vehicleId: v3._id,
    agencyId: mudian._id, type: 'mechanical', priority: 'high',
    description: 'Tyre pressure warning light on rear axle during trip.',
    location: { latitude: 3.848, longitude: 11.502, address: 'Near Edéa junction' },
    status: 'open',
  });

  log(`Created ${1} incident`);

  // ── Summary ──────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════');
  log('  Seed complete. Login credentials:');
  log('  Admin:        admin@movesmart.cm');
  log('  Fleet Mgr:    amara@mudian.cm');
  log('  Driver:       jean@mudian.cm');
  log('  Passenger:    carine@gmail.com');
  log('  All passwords: password123');
  log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
