require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function dryRunIntraChannelPrune() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== DRY RUN: Intra-Channel Duplicate Pruning ===");

  const duplicates = await TelegramResource.aggregate([
    {
      $match: {
        isAvailable: { $ne: false },
        fileSize: { $gt: 0 },
        fileName: { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: {
          channel: "$channelUsername",
          fileSize: "$fileSize",
          fileNameLower: { $toLower: { $trim: { input: "$fileName" } } }
        },
        count: { $sum: 1 },
        items: {
          $push: {
            _id: "$_id",
            messageId: "$messageId",
            downloadCount: "$downloadCount",
            groupId: "$groupId",
            groupIndex: "$groupIndex",
            groupTotal: "$groupTotal",
            cleanTitle: "$cleanTitle",
            messageDate: "$messageDate"
          }
        }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`Found ${duplicates.length} duplicate file groups in DB.`);
  let totalRedundant = 0;
  duplicates.forEach(d => {
    totalRedundant += (d.count - 1);
  });
  console.log(`Total redundant duplicate documents to set isAvailable: false: ${totalRedundant}`);

  // Check breakdown by channel for top channels
  const chCount = {};
  duplicates.forEach(d => {
    const ch = d._id.channel;
    chCount[ch] = (chCount[ch] || 0) + (d.count - 1);
  });

  const sortedChannels = Object.entries(chCount).sort((a, b) => b[1] - a[1]);
  console.log("\nTop 10 channels by redundant copies:");
  sortedChannels.slice(0, 10).forEach(([ch, cnt]) => {
    console.log(`  @${ch}: ${cnt} redundant copies`);
  });

  // Verify logic on sample groups (e.g. logic exam in freshmanebook or keleme_2013)
  console.log("\nSample selection for 'logic mid exam AAU.pdf' in @freshmanebook:");
  const sampleAAU = duplicates.find(d => d._id.channel === 'freshmanebook' && d._id.fileNameLower.includes('logic mid exam'));
  if (sampleAAU) {
    console.log(`Group size: ${sampleAAU.count}`);
    // Selection logic
    const sorted = [...sampleAAU.items].sort((a, b) => {
      // 1. Download count
      if ((b.downloadCount || 0) !== (a.downloadCount || 0)) {
        return (b.downloadCount || 0) - (a.downloadCount || 0);
      }
      // 2. Prefer grouped with valid index
      const aGrouped = (a.groupId && a.groupIndex === 1) ? 1 : 0;
      const bGrouped = (b.groupId && b.groupIndex === 1) ? 1 : 0;
      if (bGrouped !== aGrouped) return bGrouped - aGrouped;
      // 3. Newest messageId
      return b.messageId - a.messageId;
    });

    const canonical = sorted[0];
    const redundant = sorted.slice(1);
    console.log(`  Canonical to KEEP active: msg ${canonical.messageId} | ID: ${canonical._id} | grp: ${canonical.groupId} | grpIdx: ${canonical.groupIndex}`);
    console.log(`  Redundant to SET isAvailable: false:`);
    redundant.forEach(r => {
      console.log(`    - msg ${r.messageId} | ID: ${r._id} | grp: ${r.groupId} | grpIdx: ${r.groupIndex}`);
    });
  }

  await mongoose.disconnect();
}
dryRunIntraChannelPrune().catch(console.error);
