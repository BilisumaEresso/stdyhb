require('dotenv').config();
const mongoose = require('mongoose');

async function testConn() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing from process.env');
    process.exit(1);
  }
  
  const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`Connecting to: ${maskedUri}`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    });
    console.log('✅ Connected successfully!');
    
    const db = mongoose.connection.db;
    console.log(`Database Name: ${db.databaseName}`);
    
    const buildInfo = await db.command({ buildInfo: 1 }).catch(() => null);
    if (buildInfo) {
      console.log(`MongoDB Server Version: ${buildInfo.version}`);
      console.log(`MongoDB Git Version: ${buildInfo.gitVersion}`);
      console.log(`MongoDB Sys Info: ${buildInfo.sysInfo || buildInfo.versionArray?.join('.')}`);
    }
    
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in database:');
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments().catch(() => -1);
      console.log(`  - ${c.name}: ${count} documents`);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected cleanly.');
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

testConn();
