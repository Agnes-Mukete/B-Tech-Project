/**
 * Integration test: full passenger booking flow
 * Agency register → approve → passenger selects → books → cancels
 */
const request  = require('supertest');
const mongoose = require('mongoose');
const { app }  = require('../src/server');

const Agency  = require('../src/models/Agency');
const User    = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Route   = require('../src/models/Route');
const Trip    = require('../src/models/Trip');
const Booking = require('../src/models/Booking');

const DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/movesmart_int_test';
let adminToken, passengerToken, fleetToken;
let agencyId, tripId, bookingId;

beforeAll(async () => {
  await mongoose.connect(DB);
  // Clean slate
  await Promise.all([Agency, User, Vehicle, Route, Trip, Booking].map(M => M.deleteMany({})));

  // Register admin
  const a = await request(app).post('/api/auth/register').send({
    name: 'Admin', email: 'admin@int.cm', password: 'admin1234', role: 'admin',
  });
  adminToken = a.body.data?.accessToken;

  // Register passenger
  const p = await request(app).post('/api/auth/register').send({
    name: 'Pax Test', email: 'pax@int.cm', password: 'pax12345', role: 'passenger',
  });
  passengerToken = p.body.data?.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// ── 1. Agency registration & approval ────────────────────────────────
describe('Agency lifecycle', () => {
  it('registers a new agency (pending)', async () => {
    const res = await request(app).post('/api/agencies').send({
      name: 'Test Agency', shortCode: 'TA', ownerName: 'Owner', ownerPhone: '+237000000000',
      ownerEmail: 'owner@testagency.cm', city: 'Yaoundé', coverageCities: ['Yaoundé', 'Douala'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    agencyId = res.body.data._id;
  });

  it('admin approves the agency', async () => {
    const res = await request(app)
      .patch(`/api/agencies/${agencyId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.visible).toBe(true);
  });

  it('approved agency appears in public listing', async () => {
    const res = await request(app).get('/api/agencies');
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a._id === agencyId)).toBe(true);
  });
});

// ── 2. Fleet setup ────────────────────────────────────────────────────
describe('Fleet setup (fleet manager)', () => {
  let fmId;

  it('admin creates a fleet manager linked to the agency', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fleet Mgr', email: 'fm@testagency.cm',
        password: 'fleet1234', role: 'fleetManager', agencyId,
      });
    expect(res.status).toBe(201);
    fmId = res.body.data._id;
  });

  it('fleet manager logs in', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'fm@testagency.cm', password: 'fleet1234',
    });
    expect(res.status).toBe(200);
    fleetToken = res.body.data.accessToken;
  });

  it('fleet manager creates a vehicle', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${fleetToken}`)
      .send({ plateNumber: 'INT-001-YA', type: 'bus', capacity: 20 });
    expect(res.status).toBe(201);
    expect(res.body.data.agencyId).toBe(agencyId);
  });
});

// ── 3. Route & trip creation ──────────────────────────────────────────
describe('Route and trip', () => {
  let routeId, vehicleId, driverId;

  beforeAll(async () => {
    // Create driver
    const dr = await request(app).post('/api/auth/register').send({
      name: 'Driver Int', email: 'drv@testagency.cm', password: 'drv12345',
      role: 'driver', agencyId,
    });
    driverId = dr.body.data?.user?._id;

    const veh = await Vehicle.findOne({ agencyId });
    vehicleId = veh?._id?.toString();
  });

  it('fleet manager creates a route', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${fleetToken}`)
      .send({
        name: 'Test Route', origin: 'Yaoundé', destination: 'Douala',
        distanceKm: 240, estimatedDuration: 225, baseFare: 3000,
        stops: [{ name: 'Yaoundé', order: 1 }, { name: 'Douala', order: 2 }],
      });
    expect(res.status).toBe(201);
    routeId = res.body.data._id;
  });

  it('fleet manager schedules a trip', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${fleetToken}`)
      .send({
        routeId, vehicleId, driverId,
        scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
        scheduledEnd:   new Date(Date.now() + 7_200_000).toISOString(),
      });
    expect(res.status).toBe(201);
    tripId = res.body.data._id;
  });

  it('passenger finds trip via agency trip search', async () => {
    const res = await request(app)
      .get(`/api/agencies/${agencyId}/trips`)
      .query({ from: 'Yaoundé', to: 'Douala' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ── 4. Booking flow ───────────────────────────────────────────────────
describe('Passenger booking flow', () => {
  it('passenger gets the seat map', async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}/seats`)
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.seats.length).toBeGreaterThan(0);
  });

  it('passenger books a seat', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ tripId, seatLabel: 'A1', cardLast4: '4242', cardType: 'Visa' });
    expect(res.status).toBe(201);
    expect(res.body.data.bookingRef).toMatch(/^MVS-/);
    bookingId = res.body.data._id;
  });

  it('seat A1 is now marked booked', async () => {
    const trip = await Trip.findById(tripId);
    const seat = trip.seats.find(s => s.label === 'A1');
    expect(seat.status).toBe('booked');
  });

  it('duplicate booking of same seat is rejected', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ tripId, seatLabel: 'A1' });
    expect(res.status).toBe(400);
  });

  it('passenger views booking history', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('passenger cancels booking (> 2hrs before departure)', async () => {
    const res = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('seat A1 is released after cancellation', async () => {
    const trip = await Trip.findById(tripId);
    const seat = trip.seats.find(s => s.label === 'A1');
    expect(seat.status).toBe('available');
  });
});

// ── 5. Agency scope enforcement ───────────────────────────────────────
describe('Agency scope — cross-agency access blocked', () => {
  it('fleet manager cannot see vehicles from other agency', async () => {
    // Create a second agency and vehicle
    const ag2 = await Agency.create({
      name: 'Other Agency', shortCode: 'OA', ownerName: 'Other', ownerPhone: '+237111111111',
      ownerEmail: 'other@agency.cm', city: 'Douala', status: 'active', visible: true,
    });
    await Vehicle.create({
      vehicleId: 'OV01', plateNumber: 'OV-001', type: 'bus', capacity: 30,
      agencyId: ag2._id,
    });

    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${fleetToken}`);

    expect(res.status).toBe(200);
    // All returned vehicles must belong to this fleet manager's agency
    res.body.data.forEach(v => {
      expect(String(v.agencyId)).toBe(agencyId);
    });
  });
});
