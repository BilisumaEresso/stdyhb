/**
 * execute-bundle-backfill.js
 *
 * Phase 1 Production Migration:
 * Clusters and backfills legacy unbundled Telegram resources (photo albums and document packets)
 * across all channels, assigns consistent group metadata (groupId, groupIndex: 1..N, groupTotal: N),
 * establishes clean titles, and builds high-performance indexes on MongoDB Atlas.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { generateDisplayTitle } = require("../src/utils/titleGenerator");

function normalizeCaption(cap = "") {
  return cap
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/[#_*~`!?,.:;()[\]{}|/\\<>\-+=]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function captionsMatch(capA, capB) {
  const normA = normalizeCaption(capA);
  const normB = normalizeCaption(capB);

  if (!normA && !normB) return true; // Both empty
  if (normA === normB) return true; // Exact match

  // If one is empty or very short (<10 chars) and the other exists
  if (normA.length < 10 || normB.length < 10) {
    return true;
  }

  // Check prefix match or substantial overlap
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 15 && (normA.startsWith(normB.slice(0, 25)) || normB.startsWith(normA.slice(0, 25)))) {
    return true;
  }

  return false;
}

function areRelatedFiles(a, b) {
  const bothImages = a.fileType === "image" && b.fileType === "image";
  const bothDocs = a.fileType !== "image" && b.fileType !== "image";

  if (!bothImages && !bothDocs) return false;

  // For both images and documents: captions must match / be compatible
  if (captionsMatch(a.caption, b.caption)) return true;

  // For documents, also check if filenames share sequence patterns (Chapter 1, Chapter 2, etc.)
  if (bothDocs) {
    const nameA = (a.fileName || "").toLowerCase();
    const nameB = (b.fileName || "").toLowerCase();
    const seqPattern = /(chapter|unit|ch|part|lecture|mod|module)\s*[-_]?\s*(\d+)/i;
    const matchA = nameA.match(seqPattern);
    const matchB = nameB.match(seqPattern);
    if (matchA && matchB && matchA[1] === matchB[1]) {
      return true;
    }
  }

  return false;
}

async function main() {
  console.log("================================================================================");
  console.log("🚀 STARTING PHASE 1: LEGACY BUNDLE CLUSTERING & BACKFILL MIGRATION");
  console.log("================================================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB Atlas");

  // Step 1: Ensure required indexes on TelegramResource
  console.log("\n[Step 1] Ensuring MongoDB indexes on groupId and fileUniqueId...");
  try {
    await TelegramResource.collection.createIndex({ groupId: 1 }, { background: true });
    await TelegramResource.collection.createIndex({ fileUniqueId: 1 }, { background: true });
    console.log("✅ Indexes ensured: { groupId: 1 } and { fileUniqueId: 1 }");
  } catch (err) {
    console.warn("⚠️ Index creation notice:", err.message);
  }

  // Step 2: Discover channels with ungrouped items
  console.log("\n[Step 2] Scanning distinct channels with ungrouped items...");
  const channels = await TelegramResource.distinct("channelUsername", { groupId: null });
  console.log(`Found ${channels.length} channels containing ungrouped resources.\n`);

  let grandTotalClusters = 0;
  let grandTotalUpdated = 0;
  let grandTotalPhotoAlbums = 0;
  let grandTotalDocBundles = 0;

  // Step 3: Process channel by channel
  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    const ch = channels[chIdx];
    const ungrouped = await TelegramResource.find({ channelUsername: ch, groupId: null })
      .select("_id channelUsername messageId messageDate fileType fileName caption cleanTitle tags isExam courseCode university")
      .sort({ messageId: 1 })
      .lean();

    if (ungrouped.length === 0) continue;

    let clusters = [];
    let currentCluster = [];

    const flushCluster = () => {
      if (currentCluster.length > 1) {
        clusters.push([...currentCluster]);
      }
      currentCluster = [];
    };

    for (let i = 0; i < ungrouped.length; i++) {
      const doc = ungrouped[i];
      if (currentCluster.length === 0) {
        currentCluster.push(doc);
      } else {
        const last = currentCluster[currentCluster.length - 1];
        const first = currentCluster[0];

        const msgDiff = doc.messageId - last.messageId;
        const idClose = msgDiff >= 1 && msgDiff <= 3;

        let timeClose = false;
        if (last.messageDate && doc.messageDate) {
          const diffMs = Math.abs(new Date(doc.messageDate).getTime() - new Date(last.messageDate).getTime());
          const totalDiffMs = Math.abs(new Date(doc.messageDate).getTime() - new Date(first.messageDate).getTime());
          timeClose = diffMs <= 90000 && totalDiffMs <= 300000;
        }

        const sizeOk = currentCluster.length < 15;
        const compatible = areRelatedFiles(last, doc);

        if (idClose && timeClose && sizeOk && compatible) {
          currentCluster.push(doc);
        } else {
          flushCluster();
          currentCluster.push(doc);
        }
      }
    }
    flushCluster();

    if (clusters.length === 0) {
      continue;
    }

    // Build bulk updates for this channel's clusters
    const bulkOps = [];
    let channelUpdated = 0;
    let channelPhotoAlbums = 0;
    let channelDocBundles = 0;

    for (const cluster of clusters) {
      const isPhotoAlbum = cluster[0].fileType === "image";
      if (isPhotoAlbum) channelPhotoAlbums++;
      else channelDocBundles++;

      const groupId = `leg_${ch}_${cluster[0].messageId}`;
      const groupTotal = cluster.length;

      // Extract the best descriptive caption from cluster
      const primaryDoc = cluster.find(m => m.caption && m.caption.trim().length > 10) || cluster[0];
      const clusterCaption = primaryDoc.caption || "";

      // Determine bundle-level clean title
      let clusterTitle = "";
      if (clusterCaption) {
        clusterTitle = generateDisplayTitle({ caption: clusterCaption, fileName: "" });
      }

      // Check if cluster represents an exam
      const clusterIsExam = cluster.some(m => m.isExam) ||
        /\b(exam|final|mid|midterm|quiz|test|past|solved)\b/i.test(clusterCaption);

      cluster.forEach((doc, index) => {
        const updateFields = {
          groupId,
          groupIndex: index + 1, // 1-based index
          groupTotal
        };

        if (clusterIsExam && !doc.isExam) {
          updateFields.isExam = true;
        }

        // For images or missing titles, assign the clean cluster title
        if (isPhotoAlbum && clusterTitle && (!doc.cleanTitle || doc.cleanTitle === "Untitled Resource")) {
          updateFields.cleanTitle = clusterTitle;
        } else if (!doc.cleanTitle && doc.fileName) {
          updateFields.cleanTitle = generateDisplayTitle(doc);
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: updateFields }
          }
        });
        channelUpdated++;
      });
    }

    // Execute updates
    if (bulkOps.length > 0) {
      await TelegramResource.bulkWrite(bulkOps);
    }

    grandTotalClusters += clusters.length;
    grandTotalUpdated += channelUpdated;
    grandTotalPhotoAlbums += channelPhotoAlbums;
    grandTotalDocBundles += channelDocBundles;

    console.log(`[${chIdx + 1}/${channels.length}] @${ch.padEnd(25)} -> ${clusters.length.toString().padStart(3)} bundles (${channelUpdated.toString().padStart(4)} resources grouped: ${channelPhotoAlbums} photo albums, ${channelDocBundles} doc bundles)`);
  }

  console.log("\n================================================================================");
  console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY");
  console.log("================================================================================");
  console.log(`Total Channels Processed       : ${channels.length}`);
  console.log(`Total Bundles Formed           : ${grandTotalClusters}`);
  console.log(`Total Resources Grouped        : ${grandTotalUpdated}`);
  console.log(`  - Photo Albums (Exams/Notes) : ${grandTotalPhotoAlbums}`);
  console.log(`  - Document Bundles (PPT/PDF) : ${grandTotalDocBundles}`);

  // Step 4: Verification of specific test cases
  console.log("\n================ Verification of Key Targets ================");
  const kelemeDilla = await TelegramResource.find({
    channelUsername: "keleme_2013",
    messageId: { $in: [27, 28, 29] }
  }).lean();
  console.log(`@keleme_2013 msgs 27, 28, 29 status:`);
  kelemeDilla.forEach(r => {
    console.log(`  Msg ${r.messageId} | groupId: ${r.groupId} | groupIndex: ${r.groupIndex}/${r.groupTotal} | cleanTitle: "${r.cleanTitle}"`);
  });

  const freshmanTarget = await TelegramResource.find({
    channelUsername: "freshman_materials",
    messageId: { $in: [1188, 1189, 1190] }
  }).lean();
  console.log(`\n@freshman_materials msgs 1188, 1189, 1190 status:`);
  freshmanTarget.forEach(r => {
    console.log(`  Msg ${r.messageId} | groupId: ${r.groupId} | groupIndex: ${r.groupIndex}/${r.groupTotal} | fileName: "${r.fileName}"`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
