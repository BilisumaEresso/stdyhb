/**
 * 02-resource-count-reconciliation.js
 * 
 * PHASE 1 — RESOURCE COUNT RECONCILIATION
 * Read-only script auditing availability, distinct keys, and live ingestion changes.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function reconcileResourceCounts() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  const db = mongoose.connection.db;
  const resColl = db.collection("telegramresources");
  const quarColl = db.collection("telegramresourcequarantines");

  console.log("====================================================");
  console.log("TASK 1.A: RESOURCE COUNT RECONCILIATION");
  console.log("====================================================");
  console.log(`Verified At: ${new Date().toISOString()}`);

  // 1. Total documents
  const total = await resColl.countDocuments();
  console.log(`\n1. Total telegramresources:           ${total}`);

  // 2. isAvailable: true
  const available = await resColl.countDocuments({ isAvailable: true });
  console.log(`2. isAvailable === true:             ${available}`);

  // 3. isAvailable: false
  const unavailable = await resColl.countDocuments({ isAvailable: false });
  console.log(`3. isAvailable === false:            ${unavailable}`);

  // 4. Missing isAvailable
  const missingAvailable = await resColl.countDocuments({ isAvailable: { $exists: false } });
  console.log(`4. Missing isAvailable:              ${missingAvailable}`);

  // 5. Null isAvailable
  const nullAvailable = await resColl.countDocuments({ isAvailable: null });
  console.log(`5. Null isAvailable:                 ${nullAvailable}`);

  // 6. Total telegramresourcequarantines
  const quarTotal = await quarColl.countDocuments();
  console.log(`6. Total telegramresourcequarantines: ${quarTotal}`);

  // 7. Distinct channels in resources
  const distinctChannels = await resColl.distinct("channelUsername");
  console.log(`7. Distinct resource channels:        ${distinctChannels.length}`);

  // 8. Distinct Telegram message IDs
  // Since messageId is unique per channel, distinct messageId alone is not globally unique,
  // but let's check distinct message IDs across the entire collection:
  const distinctMessageIds = await resColl.distinct("messageId");
  console.log(`8. Distinct messageId values:         ${distinctMessageIds.length}`);

  // 9. Distinct fileUniqueId values
  const distinctFileUniqueIds = await resColl.distinct("fileUniqueId");
  console.log(`9. Distinct fileUniqueId values:      ${distinctFileUniqueIds.length}`);

  // Check the newest documents in telegramresources to see why count is 92,143 (+3 from 92,140)
  const newestDocs = await resColl.find({})
    .sort({ indexedAt: -1 })
    .limit(10)
    .project({
      fileName: 1,
      cleanTitle: 1,
      channelUsername: 1,
      messageId: 1,
      fileType: 1,
      indexedAt: 1,
      isAvailable: 1
    })
    .toArray();

  console.log("\n--- Most Recently Indexed Documents ---");
  newestDocs.forEach((d, idx) => {
    console.log(
      `  ${idx + 1}. [${d.fileType}] "${(d.cleanTitle || d.fileName || '').substring(0, 40)}" | @${d.channelUsername} (msg:${d.messageId}) | indexedAt: ${d.indexedAt?.toISOString() || 'N/A'} | available: ${d.isAvailable}`
    );
  });

  const reconciliationData = {
    verifiedAt: new Date().toISOString(),
    telegramresources: {
      total,
      available,
      unavailable,
      missingAvailable,
      nullAvailable,
      distinctChannelsCount: distinctChannels.length,
      distinctChannelsList: distinctChannels,
      distinctMessageIdsCount: distinctMessageIds.length,
      distinctFileUniqueIdsCount: distinctFileUniqueIds.length,
      newestIndexed: newestDocs
    },
    quarantine: {
      total: quarTotal
    }
  };

  const outputPath = path.join(__dirname, "02-resource-count-reconciliation.json");
  fs.writeFileSync(outputPath, JSON.stringify(reconciliationData, null, 2));
  console.log(`\nReconciliation saved to: ${outputPath}`);

  await mongoose.disconnect();
}

reconcileResourceCounts().catch(console.error);
