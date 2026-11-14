/**
 * 04-quarantine-integrity.js
 * 
 * PHASE 1 — QUARANTINE RECONCILIATION & INTEGRITY
 * Deep-dive into the 26-document discrepancy between unavailable resources (9,070)
 * and quarantine snapshots (9,044).
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkQuarantineIntegrity() {
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
  console.log("TASK 1.D: QUARANTINE RECONCILIATION & INTEGRITY");
  console.log("====================================================");
  console.log(`Verified At: ${new Date().toISOString()}\n`);

  // 1. Basic counts
  const totalUnavailable = await resColl.countDocuments({ isAvailable: false });
  const totalQuarantine = await quarColl.countDocuments();

  console.log(`1. Total unavailable resources (isAvailable: false): ${totalUnavailable}`);
  console.log(`2. Total quarantine snapshot documents:              ${totalQuarantine}`);
  console.log(`3. Discrepancy:                                      ${totalUnavailable - totalQuarantine} records\n`);

  // 2. Reason distribution in quarantine
  const reasonBreakdown = await quarColl.aggregate([
    { $group: { _id: "$quarantineReason", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  let sumReasons = 0;
  console.log("--- Quarantine Reason Breakdown ---");
  reasonBreakdown.forEach((r) => {
    sumReasons += r.count;
    console.log(`  • ${(r._id || 'MISSING_REASON').padEnd(30)} Count: ${r.count}`);
  });
  console.log(`Total summed from reasons: ${sumReasons} (Matches collection count: ${sumReasons === totalQuarantine})\n`);

  // 3. Restorable status breakdown
  const restorableBreakdown = await quarColl.aggregate([
    { $group: { _id: "$restorable", count: { $sum: 1 } } }
  ]).toArray();
  console.log("--- Restorable Flag Breakdown ---");
  restorableBreakdown.forEach((r) => console.log(`  • restorable: ${r._id} -> Count: ${r.count}`));

  // 4. Verify originalId mappings
  console.log("\n--- Checking originalId Referencing ---");
  const distinctQuarOriginalIds = await quarColl.distinct("originalId");
  console.log(`Distinct originalId values in quarantine: ${distinctQuarOriginalIds.length}`);

  // Are there duplicates in quarantine (same originalId quarantined twice)?
  const dupOriginalIds = await quarColl.aggregate([
    { $group: { _id: "$originalId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log(`Duplicate originalIds in quarantine:      ${dupOriginalIds.length}`);

  // Check if every originalId in quarantine exists in telegramresources
  const existingSourceCount = await resColl.countDocuments({
    _id: { $in: distinctQuarOriginalIds }
  });
  const orphanedQuarantineSnapshots = distinctQuarOriginalIds.length - existingSourceCount;
  console.log(`Quarantine records referencing existing source: ${existingSourceCount} / ${distinctQuarOriginalIds.length}`);
  console.log(`Orphaned quarantine snapshots:                  ${orphanedQuarantineSnapshots}`);

  // 5. Investigate the 26 unavailable resources that are NOT in quarantine!
  console.log("\n--- Investigating the 26 Discrepancy Records ---");
  const quarIdSet = new Set(distinctQuarOriginalIds.map((id) => id.toString()));

  // Stream all unavailable resources and find which ones lack quarantine snapshot
  const unavailCursor = resColl.find(
    { isAvailable: false },
    { projection: { _id: 1, fileName: 1, cleanTitle: 1, caption: 1, fileType: 1, channelUsername: 1, messageId: 1, indexedAt: 1, isExam: 1, isQuarantined: 1 } }
  );

  const missingQuarantineDocs = [];
  while (await unavailCursor.hasNext()) {
    const doc = await unavailCursor.next();
    if (!quarIdSet.has(doc._id.toString())) {
      missingQuarantineDocs.push(doc);
    }
  }

  console.log(`Found exactly ${missingQuarantineDocs.length} unavailable documents without a quarantine record!\n`);
  console.log("Sample of unavailable documents missing quarantine records:");
  missingQuarantineDocs.forEach((d, idx) => {
    console.log(
      `  ${idx + 1}. [${d.fileType}] "${(d.cleanTitle || d.fileName || '').substring(0, 35)}" | @${d.channelUsername} (msg:${d.messageId}) | indexedAt: ${d.indexedAt?.toISOString() || 'N/A'} | isQuarantined: ${d.isQuarantined}`
    );
  });

  const integrityReport = {
    verifiedAt: new Date().toISOString(),
    totalUnavailable,
    totalQuarantine,
    discrepancy: totalUnavailable - totalQuarantine,
    reasonBreakdown,
    reasonsReconciled: sumReasons === totalQuarantine,
    restorableBreakdown,
    distinctOriginalIdsInQuarantine: distinctQuarOriginalIds.length,
    duplicateOriginalIdsInQuarantine: dupOriginalIds.length,
    orphanedQuarantineSnapshots,
    missingFromQuarantineCount: missingQuarantineDocs.length,
    missingFromQuarantineSamples: missingQuarantineDocs
  };

  const outputPath = path.join(__dirname, "04-quarantine-integrity.json");
  fs.writeFileSync(outputPath, JSON.stringify(integrityReport, null, 2));
  console.log(`\nQuarantine integrity report saved to: ${outputPath}`);

  await mongoose.disconnect();
}

checkQuarantineIntegrity().catch(console.error);
