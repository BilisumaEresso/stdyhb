require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function pruneSameChannelDuplicates() {
  console.log("================================================================================");
  console.log("🚀 EXECUTING INTRA-CHANNEL EXACT DUPLICATE PRUNING");
  console.log("================================================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB Atlas");

  console.log("\n[Step 1] Aggregating exact file duplicates (same channel + fileName + fileSize)...");
  const duplicates = await TelegramResource.aggregate([
    {
      $match: {
        fileName: { $ne: "" },
        fileSize: { $gt: 0 },
        isAvailable: { $ne: false }
      }
    },
    {
      $group: {
        _id: { channelUsername: "$channelUsername", fileName: "$fileName", fileSize: "$fileSize" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
        messageIds: { $push: "$messageId" },
        downloadCounts: { $push: "$downloadCount" }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  console.log(`Found ${duplicates.length} duplicate groups across channels.`);

  const idsToDeactivate = [];
  let totalDownloadsMerged = 0;
  const canonicalUpdates = [];

  for (const group of duplicates) {
    // Pair up each document's id, messageId, and downloadCount
    const items = [];
    for (let i = 0; i < group.ids.length; i++) {
      items.push({
        id: group.ids[i],
        messageId: group.messageIds[i],
        downloadCount: group.downloadCounts[i] || 0
      });
    }

    // Sort: 1) highest downloads, 2) highest messageId (newest post)
    items.sort((a, b) => {
      if (b.downloadCount !== a.downloadCount) {
        return b.downloadCount - a.downloadCount;
      }
      return b.messageId - a.messageId;
    });

    const canonical = items[0];
    const redundant = items.slice(1);

    const extraDownloads = redundant.reduce((s, r) => s + r.downloadCount, 0);
    if (extraDownloads > 0) {
      canonicalUpdates.push({
        updateOne: {
          filter: { _id: canonical.id },
          update: { $inc: { downloadCount: extraDownloads } }
        }
      });
      totalDownloadsMerged += extraDownloads;
    }

    for (const r of redundant) {
      idsToDeactivate.push(r.id);
    }
  }

  console.log(`Identified ${idsToDeactivate.length} redundant documents to mark isAvailable: false.`);
  console.log(`Identified ${canonicalUpdates.length} canonical documents receiving ${totalDownloadsMerged} merged downloads.`);

  // Step 2: Merge download counts onto canonical documents
  if (canonicalUpdates.length > 0) {
    console.log("\n[Step 2] Applying download count merges to canonical records...");
    const chunkSize = 500;
    for (let i = 0; i < canonicalUpdates.length; i += chunkSize) {
      const slice = canonicalUpdates.slice(i, i + chunkSize);
      await TelegramResource.bulkWrite(slice);
    }
    console.log(`✅ Applied ${canonicalUpdates.length} download merges.`);
  }

  // Step 3: Batch update redundant items to isAvailable: false
  console.log("\n[Step 3] Batch marking redundant documents as isAvailable: false...");
  const batchSize = 1000;
  let updatedCount = 0;
  for (let i = 0; i < idsToDeactivate.length; i += batchSize) {
    const chunk = idsToDeactivate.slice(i, i + batchSize);
    const res = await TelegramResource.updateMany(
      { _id: { $in: chunk } },
      { $set: { isAvailable: false } }
    );
    updatedCount += res.modifiedCount;
    process.stdout.write(`  Updated ${updatedCount}/${idsToDeactivate.length} documents...\r`);
  }
  console.log(`\n✅ Completed! Successfully marked ${updatedCount} duplicate documents as isAvailable: false.`);

  // Step 4: Verify target channels
  console.log("\n[Step 4] Verifying remaining duplicates in target channels:");
  for (const ch of ['freshman_materials', 'keleme_2013', 'ethioacadamic', 'freshmanebook']) {
    const remaining = await TelegramResource.aggregate([
      {
        $match: {
          channelUsername: ch,
          fileName: { $ne: "" },
          fileSize: { $gt: 0 },
          isAvailable: { $ne: false }
        }
      },
      {
        $group: {
          _id: { fileName: "$fileName", fileSize: "$fileSize" },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    console.log(`  @${ch}: ${remaining.length} remaining duplicate groups.`);
  }

  await mongoose.disconnect();
  console.log("\n✅ All done!");
}
pruneSameChannelDuplicates().catch(console.error);
