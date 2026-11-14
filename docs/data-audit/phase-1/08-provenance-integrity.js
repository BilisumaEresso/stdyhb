/**
 * 08-provenance-integrity.js
 * 
 * PHASE 1 — TELEGRAM PROVENANCE INTEGRITY VERIFICATION
 * Audits the 9 essential Telegram identifiers ensuring zero file delivery regressions.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkProvenanceIntegrity() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  const db = mongoose.connection.db;
  const resColl = db.collection("telegramresources");

  console.log("====================================================");
  console.log("TASK 6: TELEGRAM RESOURCE PROVENANCE AUDIT");
  console.log("====================================================");
  console.log(`Verified At: ${new Date().toISOString()}\n`);

  const total = await resColl.countDocuments();
  const available = await resColl.countDocuments({ isAvailable: true });

  // 1. Mandatory Identity Fields
  const missingFileId = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ fileId: null }, { fileId: "" }, { fileId: { $exists: false } }]
  });

  const missingFileUniqueId = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ fileUniqueId: null }, { fileUniqueId: "" }, { fileUniqueId: { $exists: false } }]
  });

  const missingMessageId = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ messageId: null }, { messageId: { $exists: false } }, { messageId: { $lte: 0 } }]
  });

  const missingChatId = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ chatId: null }, { chatId: { $exists: false } }]
  });

  const missingChannelUsername = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ channelUsername: null }, { channelUsername: "" }, { channelUsername: { $exists: false } }]
  });

  console.log("Mandatory Telegram Identifier Completeness (Available: 83,073):");
  console.log(`  • Missing fileId:          ${missingFileId}`);
  console.log(`  • Missing fileUniqueId:    ${missingFileUniqueId}`);
  console.log(`  • Missing messageId:       ${missingMessageId}`);
  console.log(`  • Missing chatId:          ${missingChatId}`);
  console.log(`  • Missing channelUsername: ${missingChannelUsername}`);

  // 2. Archive Message Coverage
  const withArchiveMsg = await resColl.countDocuments({
    isAvailable: true,
    archiveMessageId: { $ne: null, $exists: true, $gt: 0 }
  });
  const withoutArchiveMsg = available - withArchiveMsg;
  console.log(`\nArchive Channel Redundancy:`);
  console.log(`  • Backed up in Archive (archiveMessageId > 0): ${withArchiveMsg} (${((withArchiveMsg / available) * 100).toFixed(2)}%)`);
  console.log(`  • Pending Archive Backup:                      ${withoutArchiveMsg} (${((withoutArchiveMsg / available) * 100).toFixed(2)}%)`);

  // 3. Album Internal Consistency
  console.log(`\nAlbum Provenance Consistency:`);
  // Check for duplicate groupIndex within the same groupId
  const dupIndicesInGroup = await resColl.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    { $group: { _id: { groupId: "$groupId", groupIndex: "$groupIndex" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log(`  • Albums with duplicate groupIndex collisions: ${dupIndicesInGroup.length}`);

  // Check for groupIndex > groupTotal
  const indexExceedsTotal = await resColl.countDocuments({
    isAvailable: true,
    groupId: { $ne: null },
    $expr: { $gt: ["$groupIndex", "$groupTotal"] }
  });
  console.log(`  • Records where groupIndex > groupTotal:        ${indexExceedsTotal}`);

  // Check if all files in the same album share the same channelUsername
  const multiChannelAlbums = await resColl.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    { $group: { _id: "$groupId", channels: { $addToSet: "$channelUsername" } } },
    { $project: { _id: 1, channelCount: { $size: "$channels" } } },
    { $match: { channelCount: { $gt: 1 } } }
  ]).toArray();
  console.log(`  • Albums split across multiple channels:        ${multiChannelAlbums.length}`);

  const report = {
    verifiedAt: new Date().toISOString(),
    totalAvailable: available,
    identifiers: {
      missingFileId,
      missingFileUniqueId,
      missingMessageId,
      missingChatId,
      missingChannelUsername
    },
    archiveRedundancy: {
      withArchiveMsg,
      withoutArchiveMsg,
      archivedPercentage: ((withArchiveMsg / available) * 100).toFixed(2)
    },
    albumIntegrity: {
      duplicateIndicesInGroupCount: dupIndicesInGroup.length,
      indexExceedsTotalCount: indexExceedsTotal,
      multiChannelAlbumsCount: multiChannelAlbums.length
    }
  };

  const outputPath = path.join(__dirname, "08-provenance-integrity.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nProvenance report saved to: ${outputPath}`);

  await mongoose.disconnect();
}

checkProvenanceIntegrity().catch(console.error);
