require('dotenv').config();
const mongoose = require('mongoose');

console.log('\n== MoveSmart Connection Test ==\n');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.slice(0,40) + '...' : 'MISSING');
console.log('PORT:', process.env.PORT || 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET ('+process.env.JWT_SECRET.length+' chars)' : 'MISSING');
console.log('CLIENT_URL:', process.env.CLIENT_URL || 'MISSING');

if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('xxxxx') || process.env.MONGODB_URI.includes('YOUR_PASSWORD')) {
  console.log('\nERROR: MONGODB_URI is still a placeholder. Update your .env file with your real Atlas connection string.');
  process.exit(1);
}

console.log('\nConnecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(conn => {
    console.log('SUCCESS: Connected to', conn.connection.host);
    console.log('Database:', conn.connection.name);
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('\nAll checks passed! Run: npm start\n');
    process.exit(0);
  })
  .catch(err => {
    console.log('\nFAILED:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv')) {
      console.log('\nFix: Your IP is not whitelisted in Atlas.');
      console.log('Go to: Atlas -> Network Access -> Add IP Address -> Allow from Anywhere');
    }
    if (err.message.includes('authentication')) {
      console.log('\nFix: Wrong password in your connection string.');
    }
    process.exit(1);
  });
