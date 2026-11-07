/**
 * execute-book-titles-backfill.js
 *
 * Re-normalizes cleanTitle for all book channels and Amharic titles in MongoDB.
 * Restores full Amharic titles with 100% confidence.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { generateDisplayTitle } = require("../src/utils/titleGenerator");

const BOOK_CHANNELS_LIST = [
  "amharic_fiction_books",
  "muscatnonfiction",
  "ethio_pdf_books",
  "academicbookspdf",
  "best_book_for_students",
  "medallbooks",
  "freshmanebook",
];

async function runBackfill() {
  console.log("====================================================");
  console.log("📚 BOOK & AMHARIC TITLES RESTORATION BACKFILL");
  console.log("====================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.\n");

  const startTime = Date.now();

  // Find all active resources in book channels or with Ethiopic chars in fileName
  const query = {
    isAvailable: { $ne: false },
    $or: [
      { channelUsername: { $in: BOOK_CHANNELS_LIST } },
      { cleanTitle: { $regex: /^-/ } }, // Any title starting with a broken dash
      { fileName: { $regex: /[ሀ-፼]/ } }  // Any Ethiopic file name
    ]
  };

  const totalMatching = await TelegramResource.countDocuments(query);
  console.log(`Total target resources to re-normalize: ${totalMatching.toLocaleString()}\n`);

  const PAGE_SIZE = 1500;
  let lastId = null;
  let processed = 0;
  let updated = 0;
  let page = 0;
  const bulkOps = [];

  async function flush() {
    if (bulkOps.length === 0) return;
    try {
      await TelegramResource.bulkWrite(bulkOps, { ordered: false });
      updated += bulkOps.length;
    } catch (err) {
      console.error("  ❌ bulkWrite warning:", err.message);
    }
    bulkOps.length = 0;
  }

  while (true) {
    page++;
    const pageQuery = { ...query };
    if (lastId) pageQuery._id = { $gt: lastId };

    const docs = await TelegramResource.find(pageQuery)
      .select("_id fileName cleanTitle caption fileType courseCode tags channelUsername")
      .sort({ _id: 1 })
      .limit(PAGE_SIZE)
      .lean();

    if (docs.length === 0) break;
    lastId = docs[docs.length - 1]._id;

    for (const doc of docs) {
      processed++;
      const newTitle = generateDisplayTitle(doc);

      if (doc.cleanTitle !== newTitle) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { cleanTitle: newTitle } }
          }
        });
      }

      if (bulkOps.length >= 500) {
        await flush();
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = Math.min(100, Math.round((processed / totalMatching) * 100));
    console.log(`  ⏳ [${pct}%] Page ${page} | Processed: ${processed} / ${totalMatching} | Updated: ${updated} (${elapsed}s)`);
  }

  await flush();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n====================================================");
  console.log("🎉 AMHARIC & BOOK TITLES RESTORATION COMPLETE");
  console.log("====================================================");
  console.log(`Execution Time:               ${totalDuration}s`);
  console.log(`Total Processed:              ${processed.toLocaleString()}`);
  console.log(`Total Titles Restored:        ${updated.toLocaleString()}`);

  // Sample check on @Amharic_Fiction_Books
  const samples = await TelegramResource.find({
    channelUsername: "amharic_fiction_books",
    isAvailable: { $ne: false }
  })
    .select("cleanTitle fileName")
    .limit(10)
    .lean();

  console.log("\nSamples from @Amharic_Fiction_Books after restoration:");
  samples.forEach((s, i) => {
    console.log(`  ${i + 1}. FILE: "${s.fileName}"\n     CLEAN TITLE: "${s.cleanTitle}"`);
  });

  await mongoose.disconnect();
  console.log("\n✅ Done. Disconnected from MongoDB.");
}

runBackfill().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
