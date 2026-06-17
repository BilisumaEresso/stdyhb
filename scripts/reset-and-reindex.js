require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

const TelegramResource = require("../src/db/models/TelegramResource");
const CachedSearch = require("../src/db/models/CachedSearch");
const SavedResource = require("../src/db/models/SavedResource");
const TelegramChannel = require("../src/db/models/TelegramChannel");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function runReset() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const activeChannels = await TelegramChannel.countDocuments({ active: true });

  console.log(`⚠️  STUDYHUB RESET`);
  console.log(`════════════════════════════════`);
  console.log(`This will permanently:`);
  console.log(`  · Wipe ALL TelegramResource documents`);
  console.log(`  · Wipe ALL CachedSearch documents  `);
  console.log(`  · Wipe ALL SavedResource documents`);
  console.log(`  · Reset all TelegramChannel stats`);
  console.log(`    (lastScannedAt → null, totalIndexed → 0,`);
  console.log(`     health → ACTIVE, lastError → null)`);
  console.log(``);
  console.log(`The following will NOT be touched:`);
  console.log(`  · Users`);
  console.log(`  · SearchHistory  `);
  console.log(`  · DownloadHistory`);
  console.log(`  · ChannelRecommendation`);
  console.log(`  · Channel list itself (only stats reset)`);
  console.log(``);
  console.log(`Active channels queued for re-index: ${activeChannels}`);
  console.log(``);

  rl.question('Type RESET to confirm, anything else to cancel:\n> ', async (answer) => {
    if (answer.trim() !== "RESET") {
      console.log("Cancelled.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("\nExecuting reset...");

    await mongoose.connection.collection('telegramresources').drop().catch(() => {});
    await mongoose.connection.collection('cachedsearches').drop().catch(() => {});
    await mongoose.connection.collection('savedresources').drop().catch(() => {});

    await TelegramChannel.updateMany({}, {
      $set: {
        lastScannedAt: null,
        lastSuccessfulScan: null,
        totalIndexed: 0,
        healthStatus: 'ACTIVE',
        failureCount: 0,
        lastError: null
      }
    });

    console.log("\n✅ Reset complete.");
    console.log("   TelegramResource: wiped");
    console.log("   CachedSearch: wiped");
    console.log("   SavedResource: wiped");
    console.log(`   TelegramChannel: ${activeChannels} channels reset, ready to scan\n`);
    console.log("Run node scripts/run-full-index.js to start indexing.");

    await mongoose.disconnect();
    process.exit(0);
  });
}

runReset().catch(console.error);
