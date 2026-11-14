require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("../src/db/models/TelegramChannel");
const TelegramResource = require("../src/db/models/TelegramResource");
const searchService = require("../src/search/search.service");

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("================================================================================");
  console.log("1. CHANNELS ADDED EARLY (JUNE 2026 - OCTOBER 2026)");
  console.log("================================================================================");

  // Find all channels sorted by createdAt
  const allChannels = await TelegramChannel.find().sort({ createdAt: 1 }).lean();
  
  // Categorize by batches
  const juneBatch = allChannels.filter(c => c.createdAt && new Date(c.createdAt) < new Date("2026-07-01"));
  const julyOctBatch = allChannels.filter(c => c.createdAt && new Date(c.createdAt) >= new Date("2026-07-01") && new Date(c.createdAt) < new Date("2026-11-01"));
  const novBatch = allChannels.filter(c => c.createdAt && new Date(c.createdAt) >= new Date("2026-11-01"));

  console.log(`\n--- Early Batch 1: June 2026 (${juneBatch.length} channels) ---`);
  juneBatch.forEach((c, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. @${c.username.padEnd(25)} | Added: ${c.createdAt?.toISOString().split('T')[0]} | Indexed: ${c.totalIndexed} | Type: ${c.type} | Health: ${c.healthStatus}`);
  });

  console.log(`\n--- Early Batch 2: July - October 2026 (${julyOctBatch.length} channels, including freshman_materials) ---`);
  julyOctBatch.forEach((c, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. @${c.username.padEnd(28)} | Added: ${c.createdAt?.toISOString().split('T')[0]} | Indexed: ${c.totalIndexed} | Type: ${c.type} | Health: ${c.healthStatus}`);
  });

  console.log("\n================================================================================");
  console.log("2. FIVE OLDEST/EARLIEST CHANNELS AND RESOURCES UNDER THEM");
  console.log("================================================================================");

  // Five oldest channels that actually have resources indexed
  const fiveOldestWithResources = allChannels.filter(c => c.totalIndexed > 0).slice(0, 5);

  for (let idx = 0; idx < fiveOldestWithResources.length; idx++) {
    const ch = fiveOldestWithResources[idx];
    console.log(`\n[Channel #${idx + 1}] @${ch.username}`);
    console.log(`  Added Date: ${ch.createdAt?.toISOString()}`);
    console.log(`  Total Indexed: ${ch.totalIndexed}`);
    console.log(`  Category: ${ch.type} | University: ${ch.university || 'N/A'}`);

    const resCount = await TelegramResource.countDocuments({ channelUsername: ch.username });
    const groupedCount = await TelegramResource.countDocuments({ channelUsername: ch.username, groupId: { $ne: null } });
    const ungroupedCount = await TelegramResource.countDocuments({ channelUsername: ch.username, groupId: null });
    const images = await TelegramResource.countDocuments({ channelUsername: ch.username, fileType: "image" });
    const pdfs = await TelegramResource.countDocuments({ channelUsername: ch.username, fileType: "pdf" });
    const ppts = await TelegramResource.countDocuments({ channelUsername: ch.username, fileType: "ppt" });

    console.log(`  Actual DB resources: ${resCount} (Grouped: ${groupedCount}, Ungrouped: ${ungroupedCount} | Images: ${images}, PDFs: ${pdfs}, PPTs: ${ppts})`);

    // Sample 5 resources under this channel
    const sampleResources = await TelegramResource.find({ channelUsername: ch.username })
      .sort({ messageId: 1 })
      .limit(5)
      .lean();

    console.log(`  Sample 5 Resources:`);
    sampleResources.forEach((r, rIdx) => {
      console.log(`    ${rIdx + 1}. MsgId: ${r.messageId} | Type: ${r.fileType} | GroupId: ${r.groupId || 'null'} | Title: "${r.cleanTitle || r.fileName || 'Untitled'}" | Caption: "${(r.caption || '').replace(/\r?\n/g, ' ').substring(0, 50)}..."`);
    });
  }

  console.log("\n================================================================================");
  console.log("3. DEEP AUDIT OF ALBUM / BUNDLE DUPLICATION IN @keleme_2013 & @freshman_materials");
  console.log("================================================================================");

  for (const chName of ["keleme_2013", "freshman_materials"]) {
    console.log(`\n>>> Auditing @${chName} <<<`);
    const total = await TelegramResource.countDocuments({ channelUsername: chName });
    const ungrouped = await TelegramResource.countDocuments({ channelUsername: chName, groupId: null });
    const ungroupedImages = await TelegramResource.countDocuments({ channelUsername: chName, groupId: null, fileType: "image" });
    const ungroupedDocs = await TelegramResource.countDocuments({ channelUsername: chName, groupId: null, fileType: { $ne: "image" } });

    console.log(`  Total: ${total} | Ungrouped: ${ungrouped} (Images: ${ungroupedImages}, Docs: ${ungroupedDocs})`);

    // Detect clusters of ungrouped messages that share identical/similar caption or consecutive messageIds
    const ungroupedSample = await TelegramResource.find({ channelUsername: chName, groupId: null })
      .sort({ messageId: 1 })
      .limit(200)
      .lean();

    // Group by caption
    const captionGroups = new Map();
    ungroupedSample.forEach(r => {
      const capKey = (r.caption || "").trim().toLowerCase().slice(0, 80);
      if (capKey.length > 10) {
        if (!captionGroups.has(capKey)) captionGroups.set(capKey, []);
        captionGroups.get(capKey).push(r);
      }
    });

    let albumClusters = 0;
    let albumClusterItems = 0;
    console.log(`  Detected Ungrouped Sibling Clusters (Identical Caption, consecutive messages):`);
    for (const [cap, items] of captionGroups.entries()) {
      if (items.length > 1) {
        albumClusters++;
        albumClusterItems += items.length;
        if (albumClusters <= 5) {
          console.log(`    Cluster ${albumClusters}: "${items[0].caption.replace(/\r?\n/g, ' ').slice(0, 60)}..."`);
          console.log(`      Found ${items.length} separate DB items with messageIds: ${items.map(i => i.messageId).join(", ")} | types: ${items.map(i => i.fileType).join(", ")}`);
        }
      }
    }
    console.log(`  Total clusters with >1 identical items in sample: ${albumClusters} clusters (${albumClusterItems} total items)`);
  }

  console.log("\n================================================================================");
  console.log("4. REAL SEARCH REPRODUCTION (BOT & WEB ENGINE)");
  console.log("================================================================================");
  // Run real searches that hit keleme_2013 and freshman_materials
  const testQueries = ["Debremarkos University Mathematics", "Dilla University Mathematics", "Emerging technology ppt"];
  for (const q of testQueries) {
    console.log(`\n--- Searching for: "${q}" ---`);
    const results = await searchService.searchResources(q, null);
    console.log(`Search returned ${results.length} total results.`);
    console.log(`Top 8 results for "${q}":`);
    results.slice(0, 8).forEach((r, i) => {
      console.log(`  [${i + 1}] Title: "${r.title}" | Ch: @${r.channelUsername} | MsgId: ${r.url ? r.url.split('/').pop() : r.messageId} | Type: ${r.type} | GroupId: ${r.groupId || 'null'} | IsGrouped: ${r._isGrouped || false} | Score: ${r.score}`);
    });
  }

  await mongoose.disconnect();
}

diagnose().catch(console.error);
