require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function dryRunChannelByChannel() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== DRY RUN: Intra-Channel Duplicate Pruning (Channel-by-Channel) ===");

  const channels = await TelegramResource.distinct("channelUsername");
  console.log(`Scanning ${channels.length} channels...`);

  let grandTotalDuplicateGroups = 0;
  let grandTotalRedundantDocs = 0;
  const channelStats = [];

  for (let idx = 0; idx < channels.length; idx++) {
    const ch = channels[idx];
    const docs = await TelegramResource.find({
      channelUsername: ch,
      isAvailable: { $ne: false },
      fileSize: { $gt: 0 },
      fileName: { $exists: true, $ne: "" }
    }).select("_id messageId fileSize fileName downloadCount groupId groupIndex groupTotal cleanTitle").lean();

    if (docs.length === 0) continue;

    const fileMap = new Map();
    for (const d of docs) {
      const key = `${d.fileName.trim().toLowerCase()}::${d.fileSize}`;
      if (!fileMap.has(key)) fileMap.set(key, []);
      fileMap.get(key).push(d);
    }

    let chDupGroups = 0;
    let chRedundantDocs = 0;

    for (const [key, items] of fileMap.entries()) {
      if (items.length > 1) {
        chDupGroups++;
        chRedundantDocs += (items.length - 1);
      }
    }

    if (chRedundantDocs > 0) {
      channelStats.push({ channel: ch, dupGroups: chDupGroups, redundant: chRedundantDocs });
      grandTotalDuplicateGroups += chDupGroups;
      grandTotalRedundantDocs += chRedundantDocs;
    }
  }

  channelStats.sort((a, b) => b.redundant - a.redundant);

  console.log(`\n=== SCAN SUMMARY ===`);
  console.log(`Total duplicate file groups across channels: ${grandTotalDuplicateGroups}`);
  console.log(`Total redundant copies to be pruned: ${grandTotalRedundantDocs}`);
  console.log(`Top 15 channels by redundant files:`);
  channelStats.slice(0, 15).forEach((cs, i) => {
    console.log(`  [${i + 1}] @${cs.channel}: ${cs.redundant} redundant copies (${cs.dupGroups} groups)`);
  });

  await mongoose.disconnect();
}
dryRunChannelByChannel().catch(console.error);
