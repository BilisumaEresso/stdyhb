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

  // If one is empty or very short (<10 chars) and the other exists, in Telegram albums subsequent items have empty captions
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
  // If images
  if (a.fileType === "image" && b.fileType === "image") {
    return true; // Images within 90s and <=3 msgId in same channel are virtually always an album
  }

  // If documents (pdf, ppt, doc)
  if (a.fileType !== "image" && b.fileType !== "image") {
    // If captions match
    if (captionsMatch(a.caption, b.caption)) return true;

    // Or check if filenames share sequence patterns: e.g. "Chapter 1", "Chapter 2" or "Unit 1", "Unit 2"
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

async function runDryRun() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Dry Run: Legacy Bundle Clustering Analysis ===");

  // Find all ungrouped resources
  console.log("Fetching ungrouped resources...");
  const ungrouped = await TelegramResource.find({ groupId: null })
    .select("_id channelUsername messageId messageDate fileType fileName caption cleanTitle tags isExam courseCode university")
    .sort({ channelUsername: 1, messageId: 1 })
    .lean();

  console.log(`Loaded ${ungrouped.length} ungrouped resources.`);

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

      const sameChannel = last.channelUsername === doc.channelUsername;
      const msgDiff = doc.messageId - last.messageId;
      const idClose = msgDiff >= 1 && msgDiff <= 3; // within 3 message IDs

      let timeClose = false;
      if (last.messageDate && doc.messageDate) {
        const diffMs = Math.abs(new Date(doc.messageDate).getTime() - new Date(last.messageDate).getTime());
        // Max 90 seconds between adjacent items, and max 5 minutes for the entire album/bundle
        const totalDiffMs = Math.abs(new Date(doc.messageDate).getTime() - new Date(first.messageDate).getTime());
        timeClose = diffMs <= 90000 && totalDiffMs <= 300000;
      }

      // Max cluster size 15 (Telegram albums are max 10, document batches rarely >12)
      const sizeOk = currentCluster.length < 15;

      const compatible = areRelatedFiles(last, doc);

      if (sameChannel && idClose && timeClose && sizeOk && compatible) {
        currentCluster.push(doc);
      } else {
        flushCluster();
        currentCluster.push(doc);
      }
    }
  }
  flushCluster();

  console.log(`\n================ Summary of Clustering ================`);
  const totalClusteredResources = clusters.reduce((sum, c) => sum + c.length, 0);
  console.log(`Total Clusters Found: ${clusters.length}`);
  console.log(`Total Resources to be Grouped: ${totalClusteredResources}`);

  // Channel breakdown
  const channelClusters = new Map();
  clusters.forEach(c => {
    const ch = c[0].channelUsername;
    channelClusters.set(ch, (channelClusters.get(ch) || 0) + 1);
  });

  console.log(`\nTop Channels by Clustered Bundles:`);
  Array.from(channelClusters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([ch, cnt]) => {
      console.log(`  @${ch.padEnd(25)} : ${cnt} bundles`);
    });

  // Type breakdown
  let photoAlbums = 0;
  let docBundles = 0;
  clusters.forEach(c => {
    if (c[0].fileType === "image") photoAlbums++;
    else docBundles++;
  });
  console.log(`\nBundle Breakdown:`);
  console.log(`  Photo Albums      : ${photoAlbums}`);
  console.log(`  Document Bundles  : ${docBundles} (PDF, PPT, DOC)`);

  // Inspect 10 sample clusters
  console.log(`\n================ Sample 10 Clusters ================`);
  clusters.slice(0, 10).forEach((c, idx) => {
    const primaryCaption = c.find(m => m.caption && m.caption.trim().length > 0)?.caption || "";
    const cleanCap = primaryCaption.replace(/\r?\n/g, " ").slice(0, 70);
    console.log(`\n[Cluster ${idx + 1}] @${c[0].channelUsername} | Size: ${c.length} | Type: ${c[0].fileType}`);
    console.log(`  Messages: ${c.map(m => m.messageId).join(", ")}`);
    console.log(`  Caption: "${cleanCap}..."`);
    console.log(`  Files:`);
    c.forEach((m, mIdx) => {
      console.log(`    ${mIdx + 1}. Msg ${m.messageId} | "${m.cleanTitle || m.fileName || 'Photo Page ' + (mIdx+1)}" | uniqueId: ${m.fileUniqueId}`);
    });
  });

  await mongoose.disconnect();
}

runDryRun().catch(console.error);
