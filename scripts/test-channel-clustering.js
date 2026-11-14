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
  // Both must be images OR both must be documents
  const bothImages = a.fileType === "image" && b.fileType === "image";
  const bothDocs = a.fileType !== "image" && b.fileType !== "image";

  if (!bothImages && !bothDocs) return false;

  // For both images and documents: captions must match / be compatible
  if (captionsMatch(a.caption, b.caption)) return true;

  // For documents, also check if filenames share sequence patterns
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

async function testChannel(ch) {
  console.log(`\n================ Testing Channel: @${ch} ================`);
  const t0 = Date.now();
  const ungrouped = await TelegramResource.find({ channelUsername: ch, groupId: null })
    .select("_id channelUsername messageId messageDate fileType fileName caption cleanTitle tags isExam courseCode university")
    .sort({ messageId: 1 })
    .lean();
  console.log(`Fetched ${ungrouped.length} ungrouped items in ${Date.now() - t0}ms`);

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

  console.log(`Found ${clusters.length} clusters comprising ${clusters.reduce((s, c) => s + c.length, 0)} resources.`);

  // Sample first 5 clusters
  clusters.slice(0, 5).forEach((c, idx) => {
    const cap = (c.find(m => m.caption)?.caption || "").replace(/\r?\n/g, " ").slice(0, 60);
    console.log(`  Cluster ${idx + 1}: size=${c.length}, type=${c[0].fileType}, msgs=[${c.map(m => m.messageId).join(",")}]`);
    console.log(`    Cap: "${cap}..."`);
    c.forEach(m => console.log(`      msg ${m.messageId}: "${m.fileName || m.cleanTitle || 'Photo'}"`));
  });
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  await testChannel("keleme_2013");
  await testChannel("freshman_materials");
  await mongoose.disconnect();
}

run().catch(console.error);
