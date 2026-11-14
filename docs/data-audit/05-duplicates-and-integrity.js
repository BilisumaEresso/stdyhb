const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function auditDuplicatesAndIntegrity() {
  const uri = process.env.MONGO_URI;
  
  let connected = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4
      });
      connected = true;
      break;
    } catch (err) {
      console.warn(`Connection attempt ${attempt} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!connected) process.exit(1);

  const db = mongoose.connection.db;
  const resColl = db.collection('telegramresources');
  const chColl = db.collection('telegramchannels');

  console.log('=== AUDITING DUPLICATES & DATA INTEGRITY ===\n');

  // 1. Exact duplicates by fileUniqueId (Available)
  console.log('Analyzing fileUniqueId duplicates...');
  const fileUniqueIdDups = await resColl.aggregate([
    { $match: { isAvailable: true, fileUniqueId: { $exists: true, $nin: [null, ""] } } },
    {
      $group: {
        _id: "$fileUniqueId",
        count: { $sum: 1 },
        channels: { $addToSet: "$channelUsername" },
        fileNames: { $addToSet: "$fileName" },
        fileTypes: { $addToSet: "$fileType" },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const totalDupFileUniqueIds = fileUniqueIdDups.length;
  const totalDocsInFileUniqueIdDups = fileUniqueIdDups.reduce((acc, curr) => acc + curr.count, 0);
  const crossChannelDups = fileUniqueIdDups.filter(d => d.channels.length > 1);

  console.log(`Duplicate fileUniqueId clusters: ${totalDupFileUniqueIds}`);
  console.log(`Total documents involved in duplicates: ${totalDocsInFileUniqueIdDups}`);
  console.log(`Cross-channel duplicate clusters (same file, different channels): ${crossChannelDups.length}`);

  // Top 5 cross-channel duplicate examples
  console.log('\nTop 5 Cross-Channel Duplicate Examples:');
  crossChannelDups.slice(0, 5).forEach((d, idx) => {
    console.log(`  ${idx+1}. fileUniqueId: ${d._id} | Copies: ${d.count} | Channels: [${d.channels.join(', ')}] | Names: [${d.fileNames.slice(0, 2).join(', ')}]`);
  });

  // 2. Same fileName + fileSize duplicates
  console.log('\nAnalyzing identical fileName + fileSize...');
  const nameSizeDups = await resColl.aggregate([
    {
      $match: {
        isAvailable: true,
        fileName: { $exists: true, $nin: [null, ""] },
        fileSize: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: { fileName: "$fileName", fileSize: "$fileSize" },
        count: { $sum: 1 },
        channels: { $addToSet: "$channelUsername" },
        uniqueIds: { $addToSet: "$fileUniqueId" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const totalNameSizeClusters = nameSizeDups.length;
  const totalDocsNameSizeDups = nameSizeDups.reduce((acc, curr) => acc + curr.count, 0);
  console.log(`Identical (fileName, fileSize) clusters: ${totalNameSizeClusters} (affecting ${totalDocsNameSizeDups} documents)`);

  // 3. Channel reference integrity
  console.log('\nChecking channel reference integrity...');
  const knownChannels = await chColl.distinct('username');
  const knownChannelsSet = new Set(knownChannels.map(u => (u || '').toLowerCase().trim()));

  const distinctResChannels = await resColl.distinct('channelUsername', { isAvailable: true });
  const orphanedChannels = distinctResChannels.filter(ch => !knownChannelsSet.has((ch || '').toLowerCase().trim()));

  let orphanedDocsCount = 0;
  if (orphanedChannels.length > 0) {
    orphanedDocsCount = await resColl.countDocuments({
      isAvailable: true,
      channelUsername: { $in: orphanedChannels }
    });
  }

  console.log(`Known channels in telegramchannels collection: ${knownChannels.length}`);
  console.log(`Distinct channels referenced in telegramresources: ${distinctResChannels.length}`);
  console.log(`Channels referenced in resources but NOT in telegramchannels: ${orphanedChannels.length}`);
  console.log(`Documents belonging to orphaned channel references: ${orphanedDocsCount}`);
  if (orphanedChannels.length > 0) {
    console.log(`  Orphaned channel examples: [${orphanedChannels.slice(0, 10).join(', ')}]`);
  }

  // 4. Inconsistent dates or stubs
  const missingDates = await resColl.countDocuments({ isAvailable: true, messageDate: null });
  const futureDates = await resColl.countDocuments({ isAvailable: true, messageDate: { $gt: new Date() } });

  console.log(`\nDate Integrity:`);
  console.log(`  messageDate is null: ${missingDates}`);
  console.log(`  messageDate is in future: ${futureDates}`);

  // Save report
  fs.writeFileSync('docs/data-audit/05-duplicates-and-integrity.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    fileUniqueIdDuplicates: {
      totalClusters: totalDupFileUniqueIds,
      totalDocumentsInvolved: totalDocsInFileUniqueIdDups,
      crossChannelClusters: crossChannelDups.length,
      sampleClusters: crossChannelDups.slice(0, 10)
    },
    nameSizeDuplicates: {
      totalClusters: totalNameSizeClusters,
      totalDocumentsInvolved: totalDocsNameSizeDups
    },
    channelIntegrity: {
      knownChannelsCount: knownChannels.length,
      resourceChannelsCount: distinctResChannels.length,
      orphanedChannelsCount: orphanedChannels.length,
      orphanedDocumentsCount: orphanedDocsCount,
      orphanedChannelNames: orphanedChannels
    },
    dateIntegrity: {
      missingDates,
      futureDates
    }
  }, null, 2));

  console.log('\nWrote docs/data-audit/05-duplicates-and-integrity.json');

  await mongoose.disconnect();
}

auditDuplicatesAndIntegrity().catch(console.error);
