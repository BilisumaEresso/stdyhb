require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("../src/db/models/TelegramChannel");
const { indexChannel, getClient } = require("../src/search/telegramIndexer");

let interrupted = false;

process.on("SIGINT", () => {
  interrupted = true;
});

async function runIndexer() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Make sure GramJS is connected first so we don't count connection time
  await getClient();

  const channels = await TelegramChannel.find({ active: true }).sort({ priority: -1, totalIndexed: 1 });
  
  const total = channels.length;
  const alreadyScanned = channels.filter(c => c.totalIndexed > 0).length;
  const fresh = total - alreadyScanned;

  console.log(`════════════════════════════════`);
  console.log(`📡 STUDYHUB FULL INDEXER`);
  console.log(`════════════════════════════════`);
  console.log(`Channels to scan : ${total}`);
  console.log(`Already scanned  : ${alreadyScanned} (will do incremental update)`);
  console.log(`Fresh channels   : ${fresh} (will do full historical scan)`);
  console.log(`Started at       : ${new Date().toISOString()}`);
  console.log(`════════════════════════════════\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < channels.length; i++) {
    if (interrupted) {
      console.log(`\n⚠️ Interrupted after ${i}/${total} channels.`);
      console.log(`Run the script again to resume — completed channels will be skipped automatically.`);
      break;
    }

    const ch = channels[i];
    console.log(`[${i + 1}/${total}] @${ch.username} (${ch.priority} priority)`);
    console.log(`  ⟳ Scanning... `);
    
    const startScan = Date.now();
    const r = await indexChannel(ch.username);
    const duration = ((Date.now() - startScan) / 1000).toFixed(2);
    
    console.log(`  ✓ ${r.indexed} new resources indexed`);
    console.log(`  ✗ ${r.skipped} skipped (not files or filtered)`);
    console.log(`  ⏱ ${duration}s`);
    console.log(`  ──────────────────────────────`);

    results.push({ channel: ch.username, ...r });

    // 2000ms inter-channel delay unless it's the last one
    if (i < channels.length - 1 && !interrupted) {
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  const durationSec = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  const totalIndexed = results.reduce((sum, r) => sum + r.indexed, 0);
  
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  const topChannels = [...results].sort((a, b) => b.indexed - a.indexed).slice(0, 3);

  console.log(`\n════════════════════════════════`);
  console.log(`✅ INDEXING COMPLETE`);
  console.log(`════════════════════════════════`);
  console.log(`Total channels   : ${channels.length}`);
  console.log(`Successful       : ${successful}`);
  console.log(`Failed/Dead      : ${failed}`);
  console.log(`Total indexed    : ${totalIndexed} new resources`);
  console.log(`Duration         : ${m}m ${s}s\n`);
  
  if (topChannels.length > 0 && topChannels[0].indexed > 0) {
    console.log(`Top channels by yield:`);
    topChannels.forEach((tc, idx) => {
      if (tc.indexed > 0) console.log(`  ${idx + 1}. @${tc.channel} — ${tc.indexed} resources`);
    });
  }
  console.log(`════════════════════════════════\n`);

  await mongoose.disconnect();
  process.exit(0);
}

runIndexer().catch(err => {
  console.error("Critical indexer error:", err);
  process.exit(0);
});
