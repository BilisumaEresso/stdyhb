/**
 * execute-phase3-backfill-titles.js
 *
 * Backfills the `cleanTitle` field across all active resources in MongoDB.
 * Uses:
 *  - generateDisplayTitle(resource)
 *  - Keyset pagination (_id: { $gt: lastId })
 *  - High-throughput bulkWrite updateOne operations
 */

require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { generateDisplayTitle } = require("../src/utils/titleGenerator");

const PAGE_SIZE = 2000;
const BULK_FLUSH_SIZE = 1000;

async function runPhase3() {
  console.log("====================================================");
  console.log("🚀 PHASE 3: CLEAN TITLE BACKFILL MIGRATION");
  console.log("====================================================");
  console.log("Connecting to MongoDB Atlas...");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected successfully.\n");

  const startTime = Date.now();
  const totalCount = await TelegramResource.countDocuments({ isAvailable: { $ne: false } });
  console.log(`Total active resources to populate with cleanTitle: ${totalCount.toLocaleString()}\n`);

  let lastId = null;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let pageNumber = 0;
  const bulkOps = [];

  async function flushBulk() {
    if (bulkOps.length === 0) return;
    try {
      await TelegramResource.bulkWrite(bulkOps, { ordered: false });
      totalUpdated += bulkOps.length;
    } catch (err) {
      console.error("  ❌ bulkWrite warning:", err.message);
    }
    bulkOps.length = 0;
  }

  while (true) {
    pageNumber++;
    const query = { isAvailable: { $ne: false } };
    if (lastId) query._id = { $gt: lastId };

    const page = await TelegramResource.find(query)
      .select("_id fileName cleanTitle caption fileType courseCode tags")
      .sort({ _id: 1 })
      .limit(PAGE_SIZE)
      .lean();

    if (page.length === 0) break;
    lastId = page[page.length - 1]._id;

    for (const doc of page) {
      totalProcessed++;
      const generated = generateDisplayTitle(doc);

      if (doc.cleanTitle !== generated) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { cleanTitle: generated } },
          },
        });
      }

      if (bulkOps.length >= BULK_FLUSH_SIZE) {
        await flushBulk();
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = Math.min(100, Math.round((totalProcessed / totalCount) * 100));
    console.log(
      `  ⏳ [${pct}%] Page ${pageNumber} | Processed: ${totalProcessed.toLocaleString()} / ${totalCount.toLocaleString()} | Updated: ${totalUpdated.toLocaleString()} (${elapsed}s)`
    );
  }

  await flushBulk();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n====================================================");
  console.log("🎉 PHASE 3 BACKFILL COMPLETE");
  console.log("====================================================");
  console.log(`Execution Time:               ${totalDuration}s`);
  console.log(`Total Processed:              ${totalProcessed.toLocaleString()}`);
  console.log(`Total Clean Titles Written:   ${totalUpdated.toLocaleString()}`);

  // Sample check
  const samples = await TelegramResource.find({ isAvailable: { $ne: false } })
    .select("cleanTitle fileType downloadCount")
    .sort({ downloadCount: -1 })
    .limit(10)
    .lean();

  console.log("\nSample clean titles in DB:");
  samples.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.fileType.toUpperCase()}] "${s.cleanTitle}" (dl=${s.downloadCount})`);
  });

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB.");
}

runPhase3().catch((err) => {
  console.error("Phase 3 fatal error:", err);
  process.exit(1);
});
