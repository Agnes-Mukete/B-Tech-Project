const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const Agency = require('../src/models/Agency');
const User = require('../src/models/User');

let adminToken;
let passengerToken;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/movesmart_test_agency');

  // Create admin
  const adminRes = await request(app).post('/api/auth/register').send({
    name: 'Admin', email: 'admin@test.cm', password: 'admin123', role: 'admin',
  });
  adminToken = adminRes.body.data?.accessToken;

  // Create passenger
  const pasRes = await request(app).post('/api/auth/register').send({
    name: 'Passenger', email: 'pass@test.cm', password: 'pass123', role: 'passenger',
  });
  passengerToken = pasRes.body.data?.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
afterEach(async () => {
  await Agency.deleteMany({});
});

const agencyPayload = () => ({
  name: 'Mudian Voyages', shortCode: 'MV', ownerName: 'Pierre Nkou',
  ownerEmail: `admin${Date.now()}@mudian.cm`, ownerPhone: '+237677001122',
  city: 'Yaoundé', coverageCities: ['Yaoundé', 'Bafoussam'],
});

describe('POST /api/agencies', () => {
  it('registers a new agency with pending status', async () => {
    const res = await request(app).post('/api/agencies').send(agencyPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.visible).toBe(false);
  });
});

describe('GET /api/agencies', () => {
  it('returns only active+visible agencies to public', async () => {
    await Agency.create({ ...agencyPayload(), status: 'active', visible: true });
    await Agency.create({ ...agencyPayload(), ownerEmail: 'b@b.cm', status: 'pending', visible: false });

    const res = await request(app).get('/api/agencies');
    expect(res.status).toBe(200);
    expect(res.body.data.every(a => a.status === 'active' && a.visible === true)).toBe(true);
  });
});

describe('PATCH /api/agencies/:id/status', () => {
  it('allows admin to approve a pending agency', async () => {
    const agency = await Agency.create({ ...agencyPayload(), status: 'pending' });
    const res = await request(app)
      .patch(`/api/agencies/${agency._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.visible).toBe(true);
  });

  it('denies passenger from changing status', async () => {
    const agency = await Agency.create({ ...agencyPayload(), status: 'pending' });
    const res = await request(app)
      .patch(`/api/agencies/${agency._id}/status`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/agencies/:id/visibility', () => {
  it('toggles visibility for active agency', async () => {
    const agency = await Agency.create({ ...agencyPayload(), status: 'active', visible: true });
    const res = await request(app)
      .patch(`/api/agencies/${agency._id}/visibility`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.visible).toBe(false);
  });

  it('rejects visibility toggle on pending agency', async () => {
    const agency = await Agency.create({ ...agencyPayload(), status: 'pending' });
    const res = await request(app)
      .patch(`/api/agencies/${agency._id}/visibility`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
