// docker/mongo-init.js
// Runs once when the MongoDB container first starts.
db = db.getSiblingDB('movesmart');

db.createUser({
  user: 'movesmart',
  pwd: 'movesmart_secret',
  roles: [{ role: 'readWrite', db: 'movesmart' }],
});

// Pre-create indexes for performance (Mongoose also creates these on connect)
db.agencies.createIndex({ status: 1, visible: 1 });
db.agencies.createIndex({ ownerEmail: 1 }, { unique: true });
db.agencies.createIndex({ name: 'text', city: 'text' });

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ agencyId: 1, role: 1 });

db.vehicles.createIndex({ agencyId: 1, status: 1 });
db.trips.createIndex({ agencyId: 1, status: 1 });
db.trips.createIndex({ agencyId: 1, scheduledStart: 1 });
db.bookings.createIndex({ agencyId: 1, createdAt: -1 });
db.bookings.createIndex({ passengerId: 1, status: 1 });
db.gps_logs.createIndex({ tripId: 1, timestamp: -1 });
db.gps_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 365 days TTL

print('MongoDB init complete: movesmart database and indexes created.');
