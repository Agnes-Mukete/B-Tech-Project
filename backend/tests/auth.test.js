const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const User = require('../src/models/User');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/movesmart_test');
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
afterEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/auth/register', () => {
  it('registers a new passenger', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Carine Tabe', email: 'carine@test.cm', password: 'password123', role: 'passenger',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('carine@test.cm');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'User A', email: 'dup@test.cm', password: 'password123', role: 'passenger',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'User B', email: 'dup@test.cm', password: 'password456', role: 'passenger',
    });
    expect(res.status).toBe(400);
  });

  it('rejects fleetManager without agencyId', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'FM Test', email: 'fm@test.cm', password: 'password123', role: 'fleetManager',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/agencyId/i);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Jean Mballa', email: 'jean@test.cm', password: 'secret123', role: 'passenger',
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jean@test.cm', password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jean@test.cm', password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  it('locks account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'jean@test.cm', password: 'wrong' });
    }
    const res = await request(app).post('/api/auth/login').send({
      email: 'jean@test.cm', password: 'wrong',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/locked/i);
  });
});

describe('POST /api/auth/logout', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
