/**
 * 03-album-and-duplicate-reconciliation.js
 * 
 * PHASE 1 — ALBUM & DUPLICATE RECONCILIATION
 * Audits media groups, standalone learning objects, and content duplicates.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function reconcileAlbumsAndDuplicates() {
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
  console.log("TASK 1.B & 1.C: ALBUMS, ENTITIES & DUPLICATES");
  console.log("====================================================");
  console.log(`Verified At: ${new Date().toISOString()}\n`);

  // ─── 1. ALBUM & MEDIA GROUP AUDIT ──────────────────────────────────────────
  console.log("--- 1. Album & Media Group Structure ---");

  // Available with non-null groupId
  const availWithGroup = await resColl.countDocuments({
    isAvailable: true,
    groupId: { $ne: null, $exists: true }
  });

  // Unavailable with non-null groupId
  const unavailWithGroup = await resColl.countDocuments({
    isAvailable: false,
    groupId: { $ne: null, $exists: true }
  });

  // Total distinct groupIds
  const allDistinctGroups = await resColl.distinct("groupId", {
    groupId: { $ne: null, $exists: true }
  });

  // Available distinct groupIds
  const availDistinctGroups = await resColl.distinct("groupId", {
    isAvailable: true,
    groupId: { $ne: null, $exists: true }
  });

  // Unavailable distinct groupIds
  const unavailDistinctGroups = await resColl.distinct("groupId", {
    isAvailable: false,
    groupId: { $ne: null, $exists: true }
  });

  // Standalone available resources (groupId is null or does not exist)
  const standaloneAvail = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ groupId: null }, { groupId: { $exists: false } }]
  });

  // Standalone unavailable resources
  const standaloneUnavail = await resColl.countDocuments({
    isAvailable: false,
    $or: [{ groupId: null }, { groupId: { $exists: false } }]
  });

  // Consistency checks: invalid groupIndex
  // In telegramIndexer, groupIndex is 1-indexed. Let's check for groupIndex <= 0 or null
  const invalidGroupIndex = await resColl.countDocuments({
    groupId: { $ne: null, $exists: true },
    $or: [{ groupIndex: null }, { groupIndex: { $exists: false } }, { groupIndex: { $lte: 0 } }]
  });

  // Inconsistent groupTotal (e.g. groupTotal <= 0 or null)
  const invalidGroupTotal = await resColl.countDocuments({
    groupId: { $ne: null, $exists: true },
    $or: [{ groupTotal: null }, { groupTotal: { $exists: false } }, { groupTotal: { $lte: 0 } }]
  });

  // Discrepancy between groupTotal and actual counted documents in group
  const sampleGroups = await resColl.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    { $group: { _id: "$groupId", actualCount: { $sum: 1 }, reportedTotal: { $first: "$groupTotal" } } },
    { $project: { _id: 1, actualCount: 1, reportedTotal: 1, diff: { $subtract: ["$actualCount", "$reportedTotal"] } } },
    { $match: { diff: { $ne: 0 } } },
    { $limit: 10 }
  ]).toArray();

  const totalMismatchedGroups = await resColl.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    { $group: { _id: "$groupId", actualCount: { $sum: 1 }, reportedTotal: { $first: "$groupTotal" } } },
    { $project: { _id: 1, actualCount: 1, reportedTotal: 1, diff: { $subtract: ["$actualCount", "$reportedTotal"] } } },
    { $match: { diff: { $ne: 0 } } },
    { $count: "count" }
  ]).toArray();

  console.log(`Available records with groupId:       ${availWithGroup}`);
  console.log(`Unavailable records with groupId:     ${unavailWithGroup}`);
  console.log(`Total distinct groupId values:        ${allDistinctGroups.length}`);
  console.log(`Available distinct groupId values:    ${availDistinctGroups.length}`);
  console.log(`Unavailable distinct groupId values:  ${unavailDistinctGroups.length}`);
  console.log(`Standalone available resources:       ${standaloneAvail}`);
  console.log(`Standalone unavailable resources:     ${standaloneUnavail}`);
  console.log(`Records with invalid groupIndex:      ${invalidGroupIndex}`);
  console.log(`Records with invalid groupTotal:      ${invalidGroupTotal}`);
  console.log(`Albums where doc count != groupTotal: ${totalMismatchedGroups[0]?.count || 0}`);

  // Formula for distinct searchable entities:
  // Entity = Standalone Available Files + Collapsed Available Albums
  const distinctSearchableEntities = standaloneAvail + availDistinctGroups.length;
  console.log(`\n====================================================`);
  console.log(`DISTINCT SEARCHABLE LEARNING ENTITIES:`);
  console.log(`Formula: Standalone Available (${standaloneAvail}) + Available Albums (${availDistinctGroups.length})`);
  console.log(`Total Searchable Entities = ${distinctSearchableEntities}`);
  console.log(`====================================================\n`);

  // ─── 2. DUPLICATE AUDIT ────────────────────────────────────────────────────
  console.log("--- 2. Duplicate Content Audit ---");

  const totalAvail = await resColl.countDocuments({ isAvailable: true });

  // Missing or empty fileUniqueId
  const missingFileUniqueId = await resColl.countDocuments({
    isAvailable: true,
    $or: [{ fileUniqueId: null }, { fileUniqueId: "" }, { fileUniqueId: { $exists: false } }]
  });

  // Distinct fileUniqueIds in available
  const distinctAvailFileUniqueIds = await resColl.distinct("fileUniqueId", {
    isAvailable: true,
    fileUniqueId: { $exists: true, $nin: [null, ""] }
  });

  // Duplicate clusters (> 1 doc per fileUniqueId)
  const dupClusters = await resColl.aggregate([
    {
      $match: {
        isAvailable: true,
        fileUniqueId: { $exists: true, $nin: [null, ""] }
      }
    },
    {
      $group: {
        _id: "$fileUniqueId",
        count: { $sum: 1 },
        channels: { $addToSet: "$channelUsername" },
        fileNames: { $addToSet: "$fileName" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const totalDupClusters = dupClusters.length;
  const totalDocsInDupClusters = dupClusters.reduce((sum, c) => sum + c.count, 0);
  const duplicateSurplusInstances = totalDocsInDupClusters - totalDupClusters; // extra copies above 1
  const crossChannelClusters = dupClusters.filter((c) => c.channels.length > 1);
  const maxCopiesCluster = dupClusters[0] || null;

  console.log(`Total available documents:             ${totalAvail}`);
  console.log(`Distinct fileUniqueId values:          ${distinctAvailFileUniqueIds.length}`);
  console.log(`Missing or empty fileUniqueId:         ${missingFileUniqueId}`);
  console.log(`Duplicate fileUniqueId clusters (>1):  ${totalDupClusters}`);
  console.log(`Documents involved in duplicates:      ${totalDocsInDupClusters}`);
  console.log(`Duplicate surplus instances:           ${duplicateSurplusInstances}`);
  console.log(`Cross-channel duplicate clusters:      ${crossChannelClusters.length}`);
  if (maxCopiesCluster) {
    console.log(
      `Maximum copies of a single file:       ${maxCopiesCluster.count} copies (fileUniqueId: ${maxCopiesCluster._id}, file: "${maxCopiesCluster.fileNames[0]}", across ${maxCopiesCluster.channels.length} channels)`
    );
  }

  const resultData = {
    verifiedAt: new Date().toISOString(),
    albumMetrics: {
      availWithGroup,
      unavailWithGroup,
      totalDistinctGroups: allDistinctGroups.length,
      availDistinctGroups: availDistinctGroups.length,
      unavailDistinctGroups: unavailDistinctGroups.length,
      standaloneAvail,
      standaloneUnavail,
      invalidGroupIndex,
      invalidGroupTotal,
      mismatchedGroupTotalCount: totalMismatchedGroups[0]?.count || 0,
      distinctSearchableEntitiesFormula: "standaloneAvail + availDistinctGroups",
      distinctSearchableEntities
    },
    duplicateMetrics: {
      totalAvailableDocuments: totalAvail,
      distinctFileUniqueIds: distinctAvailFileUniqueIds.length,
      missingFileUniqueId,
      duplicateClustersCount: totalDupClusters,
      documentsInDuplicateClusters: totalDocsInDupClusters,
      duplicateSurplusInstances,
      crossChannelClustersCount: crossChannelClusters.length,
      maxCopies: maxCopiesCluster ? {
        fileUniqueId: maxCopiesCluster._id,
        count: maxCopiesCluster.count,
        channelsCount: maxCopiesCluster.channels.length,
        channels: maxCopiesCluster.channels,
        fileName: maxCopiesCluster.fileNames[0]
      } : null
    }
  };

  const outputPath = path.join(__dirname, "03-album-and-duplicate-reconciliation.json");
  fs.writeFileSync(outputPath, JSON.stringify(resultData, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  await mongoose.disconnect();
}

reconcileAlbumsAndDuplicates().catch(console.error);
