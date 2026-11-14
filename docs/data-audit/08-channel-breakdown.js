const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function channelBreakdown() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { family: 4 });
  const db = mongoose.connection.db;

  const topChannels = await db.collection('telegramresources').aggregate([
    { $match: { isAvailable: true } },
    {
      $group: {
        _id: "$channelUsername",
        count: { $sum: 1 },
        exams: { $sum: { $cond: ["$isExam", 1, 0] } },
        pdfs: { $sum: { $cond: [{ $eq: ["$fileType", "pdf"] }, 1, 0] } },
        images: { $sum: { $cond: [{ $eq: ["$fileType", "image"] }, 1, 0] } },
        ppts: { $sum: { $cond: [{ $eq: ["$fileType", "ppt"] }, 1, 0] } },
        docs: { $sum: { $cond: [{ $eq: ["$fileType", "doc"] }, 1, 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log(`=== CHANNEL BREAKDOWN (${topChannels.length} Active Channels) ===\n`);
  console.table(topChannels.slice(0, 25));

  // Match channels with metadata in telegramchannels
  const chMeta = await db.collection('telegramchannels').find({}).toArray();
  const metaMap = new Map(chMeta.map(c => [c.username?.toLowerCase(), c]));

  const enriched = topChannels.map(tc => {
    const meta = metaMap.get((tc._id || '').toLowerCase());
    return {
      channelUsername: tc._id,
      resourceCount: tc.count,
      exams: tc.exams,
      pdfs: tc.pdfs,
      images: tc.images,
      ppts: tc.ppts,
      docs: tc.docs,
      registeredDisplayName: meta?.displayName || null,
      registeredUniversity: meta?.university || "Unspecified",
      registeredDepartment: meta?.department || "Unspecified",
      registeredType: meta?.type || "general",
      healthStatus: meta?.healthStatus || "UNKNOWN"
    };
  });

  fs.writeFileSync('docs/data-audit/08-channel-breakdown.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalActiveChannels: topChannels.length,
    channels: enriched
  }, null, 2));

  console.log('Wrote docs/data-audit/08-channel-breakdown.json');

  await mongoose.disconnect();
}

channelBreakdown().catch(console.error);
