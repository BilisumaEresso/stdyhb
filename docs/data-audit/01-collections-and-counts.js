require('dotenv').config();
const mongoose = require('mongoose');

async function auditCollections() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { family: 4 });
  const db = mongoose.connection.db;

  console.log('=== DATABASE AUDIT: COLLECTIONS & DOCUMENT COUNTS ===\n');
  console.log(`Date of Inspection: ${new Date().toISOString()}`);
  console.log(`Database Name: ${db.databaseName}`);

  // Build info
  const buildInfo = await db.command({ buildInfo: 1 }).catch(() => null);
  console.log(`MongoDB Server Version: ${buildInfo?.version || 'Unknown'}\n`);

  // Collections inventory
  const collections = await db.listCollections().toArray();
  const collNames = collections.map(c => c.name).sort();

  const report = {};

  for (const name of collNames) {
    const coll = db.collection(name);
    const count = await coll.countDocuments();
    const indexes = await coll.indexes().catch(() => []);
    report[name] = { count, indexCount: indexes.length, indexes: indexes.map(i => ({ name: i.name, key: i.key, unique: !!i.unique })) };
    console.log(`Collection: ${name.padEnd(30)} Count: ${String(count).padStart(8)} | Indexes: ${indexes.length}`);
  }

  // Deep dive into telegramresources
  const resColl = db.collection('telegramresources');
  console.log('\n--- Deep Dive: telegramresources ---');
  const total = await resColl.countDocuments();
  const available = await resColl.countDocuments({ isAvailable: true });
  const unavailable = await resColl.countDocuments({ isAvailable: false });
  const unavailableUnset = await resColl.countDocuments({ isAvailable: { $exists: false } });
  
  const exams = await resColl.countDocuments({ isExam: true });
  const nonExams = await resColl.countDocuments({ isExam: false });
  const examUnset = await resColl.countDocuments({ isExam: { $exists: false } });

  const withGroupId = await resColl.countDocuments({ groupId: { $ne: null, $exists: true } });
  const withoutGroupId = await resColl.countDocuments({ $or: [{ groupId: null }, { groupId: { $exists: false } }] });

  // Distinct groups
  const distinctGroups = await resColl.distinct('groupId', { groupId: { $ne: null, $exists: true } });

  const withArchiveMsg = await resColl.countDocuments({ archiveMessageId: { $ne: null, $exists: true } });

  console.log(`Total documents:              ${total}`);
  console.log(`Available (isAvailable:true): ${available}`);
  console.log(`Unavailable (false):          ${unavailable}`);
  console.log(`isAvailable unset:            ${unavailableUnset}`);
  console.log(`isExam: true:                 ${exams}`);
  console.log(`isExam: false:                ${nonExams}`);
  console.log(`isExam unset:                 ${examUnset}`);
  console.log(`In albums/groups (groupId!=null): ${withGroupId} (across ${distinctGroups.length} unique groupIds)`);
  console.log(`Standalone (no groupId):      ${withoutGroupId}`);
  console.log(`Archived (archiveMessageId!=null): ${withArchiveMsg}`);

  // Deep dive into telegramresourcequarantines
  console.log('\n--- Deep Dive: telegramresourcequarantines ---');
  const quarColl = db.collection('telegramresourcequarantines');
  const quarTotal = await quarColl.countDocuments();
  const quarReasons = await quarColl.aggregate([
    { $group: { _id: "$quarantineReason", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log(`Total Quarantined: ${quarTotal}`);
  quarReasons.forEach(r => console.log(`  Reason: ${(r._id || 'UNSPECIFIED').padEnd(30)} Count: ${r.count}`));

  // Deep dive into telegramchannels
  console.log('\n--- Deep Dive: telegramchannels ---');
  const chColl = db.collection('telegramchannels');
  const chTotal = await chColl.countDocuments();
  const chActive = await chColl.countDocuments({ active: true });
  const chHealth = await chColl.aggregate([
    { $group: { _id: "$healthStatus", count: { $sum: 1 } } }
  ]).toArray();
  const chTypes = await chColl.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } }
  ]).toArray();
  const chUnis = await chColl.aggregate([
    { $group: { _id: "$university", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log(`Total Channels: ${chTotal} (Active flag: ${chActive})`);
  console.log('Health status breakdown:', chHealth);
  console.log('Type breakdown:', chTypes);
  console.log('Top Universities represented in channels:');
  chUnis.slice(0, 10).forEach(u => console.log(`  ${(u._id || 'Unspecified').padEnd(25)}: ${u.count}`));

  // Deep dive into users & usage
  console.log('\n--- Deep Dive: Users & Activity ---');
  const usersColl = db.collection('users');
  const usersCount = await usersColl.countDocuments();
  const usersWithUni = await usersColl.countDocuments({ university: { $ne: '', $exists: true } });
  const searchHistCount = await db.collection('searchhistories').countDocuments();
  const dlHistCount = await db.collection('downloadhistories').countDocuments();
  const savedCount = await db.collection('savedresources').countDocuments();
  const repCount = await db.collection('resourcereports').countDocuments();

  console.log(`Total Registered Users:        ${usersCount}`);
  console.log(`Users with University set:     ${usersWithUni}`);
  console.log(`Total SearchHistory entries:   ${searchHistCount}`);
  console.log(`Total DownloadHistory entries: ${dlHistCount}`);
  console.log(`Total SavedResource entries:   ${savedCount}`);
  console.log(`Total ResourceReport entries:  ${repCount}`);

  // Write sanitized stats to JSON
  const fs = require('fs');
  fs.writeFileSync('docs/data-audit/01-collections-summary.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    database: db.databaseName,
    mongoVersion: buildInfo?.version,
    counts: report,
    telegramresources: {
      total,
      available,
      unavailable,
      exams,
      withGroupId,
      distinctGroups: distinctGroups.length,
      withoutGroupId,
      withArchiveMsg
    },
    quarantine: {
      total: quarTotal,
      reasons: quarReasons
    },
    channels: {
      total: chTotal,
      health: chHealth,
      types: chTypes,
      universities: chUnis
    },
    activity: {
      users: usersCount,
      usersWithUni,
      searches: searchHistCount,
      downloads: dlHistCount,
      saves: savedCount,
      reports: repCount
    }
  }, null, 2));

  console.log('\nWrote docs/data-audit/01-collections-summary.json');

  await mongoose.disconnect();
}

auditCollections().catch(console.error);
