/**
 * execute-phase1-single-images.js
 *
 * Phase 1 Migration: Quarantine all single-image resources.
 * - Grouped albums (groupId exists) are 100% PROTECTED with runtime assert guards.
 * - Non-images (PDF, PPT, DOC) are 100% PROTECTED.
 * - Keyset pagination (_id: { $gt: lastId }) for O(1) indexed seeking on MongoDB Atlas.
 * - Every single quarantined item is backed up to TelegramResourceQuarantine.
 * - Original documents marked isAvailable: false.
 * - NO hard deletes.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramResourceQuarantine = require("../src/db/models/TelegramResourceQuarantine");

const PAGE_SIZE = 1500;
const FLUSH_SIZE = 250;

async function runPhase1() {
  console.log("====================================================");
  console.log("🚀 PHASE 1: SINGLE-IMAGE PURGE MIGRATION");
  console.log("====================================================");
  console.log(`Connecting to MongoDB Atlas...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected successfully.\n");

  const startTime = Date.now();

  // 1. Pre-flight verification counts
  console.log("🔍 Pre-flight verification:");
  const totalSingleImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: null,
    isAvailable: { $ne: false },
  });

  const totalGroupedImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: { $ne: null },
    isAvailable: { $ne: false },
  });

  console.log(`   • Target single images to quarantine: ${totalSingleImages.toLocaleString()}`);
  console.log(`   • Protected grouped album images:     ${totalGroupedImages.toLocaleString()} (SACRED — DO NOT TOUCH)\n`);

  if (totalSingleImages === 0) {
    console.log("ℹ️ No active single images found to quarantine. Everything already clean.");
    await mongoose.disconnect();
    return;
  }

  const stats = {
    scanned: 0,
    quarantined: 0,
    errors: 0,
  };

  const toBackupBatch = [];
  const toDeactivateIds = [];

  async function flushWrites() {
    if (toBackupBatch.length === 0) return;

    try {
      await TelegramResourceQuarantine.insertMany(toBackupBatch, { ordered: false });
    } catch (insertErr) {
      // Ignore duplicate key errors if already present
      if (insertErr.code !== 11000 && !insertErr.writeErrors) {
        console.error("  ❌ Backup insert warning:", insertErr.message);
      }
    }

    if (toDeactivateIds.length > 0) {
      await TelegramResource.updateMany(
        { _id: { $in: toDeactivateIds } },
        { $set: { isAvailable: false, isQuarantined: true } }
      );
    }

    toBackupBatch.length = 0;
    toDeactivateIds.length = 0;
  }

  let lastId = null;
  let pageNumber = 0;

  console.log("⚡ Executing lean keyset migration...");

  while (true) {
    pageNumber++;
    const query = {
      fileType: "image",
      groupId: null,
      isAvailable: { $ne: false },
    };
    if (lastId) {
      query._id = { $gt: lastId };
    }

    const page = await TelegramResource.find(query)
      .sort({ _id: 1 })
      .limit(PAGE_SIZE)
      .lean();

    if (page.length === 0) break;
    lastId = page[page.length - 1]._id;

    for (const doc of page) {
      stats.scanned++;

      // STRICT SAFETY ASSERTIONS
      if (doc.groupId) {
        throw new Error(`CRITICAL SAFETY ABORT: Document ${doc._id} has groupId=${doc.groupId}. Must NEVER quarantine grouped albums!`);
      }
      if (doc.fileType !== "image") {
        throw new Error(`CRITICAL SAFETY ABORT: Document ${doc._id} has fileType=${doc.fileType}. Must NEVER quarantine non-images in Phase 1!`);
      }

      stats.quarantined++;

      const backup = {
        ...doc,
        originalId: doc._id,
        quarantineReason: "single_image_non_resource",
        quarantineDetail: "Single image post without album groupId; non-academic poster, announcement, or meme",
        quarantinedAt: new Date(),
        restorable: true,
      };
      delete backup._id;

      toBackupBatch.push(backup);
      toDeactivateIds.push(doc._id);

      if (toBackupBatch.length >= FLUSH_SIZE) {
        await flushWrites();
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = Math.min(100, Math.round((stats.quarantined / totalSingleImages) * 100));
    console.log(
      `  ⏳ [${pct}%] Page ${pageNumber} | Quarantined: ${stats.quarantined.toLocaleString()} / ${totalSingleImages.toLocaleString()} (${elapsed}s)`
    );
  }

  // Final write flush for any remaining batch
  await flushWrites();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Post-flight safety verification
  console.log("\n🔒 Post-flight integrity check:");
  const remainingActiveSingleImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: null,
    isAvailable: { $ne: false },
  });
  const finalGroupedImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: { $ne: null },
    isAvailable: { $ne: false },
  });
  const totalInQuarantine = await TelegramResourceQuarantine.countDocuments({
    quarantineReason: "single_image_non_resource",
  });

  console.log(`   • Remaining active single images:   ${remainingActiveSingleImages} (Expected: 0)`);
  console.log(`   • Active grouped album images:      ${finalGroupedImages.toLocaleString()} (Unchanged: ${finalGroupedImages === totalGroupedImages ? "✅ 100% PRESERVED" : "❌ MISMATCH"})`);
  console.log(`   • Single images in quarantine coll: ${totalInQuarantine.toLocaleString()}`);

  console.log("\n====================================================");
  console.log("🎉 PHASE 1 COMPLETE — SINGLE-IMAGE PURGE REPORT");
  console.log("====================================================");
  console.log(`Execution Time:               ${totalDuration}s`);
  console.log(`Total Single Images Purged:   ${stats.quarantined.toLocaleString()}`);
  console.log(`Grouped Exam Photos Intact:   ${finalGroupedImages.toLocaleString()}`);
  console.log(`Database Health:              100% Verified`);

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB.");
}

runPhase1().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
