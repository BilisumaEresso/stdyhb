require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("../src/db/models/TelegramChannel");
const TelegramResource = require("../src/db/models/TelegramResource");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  // All channels sorted by createdAt / _id
  const channels = await TelegramChannel.find().sort({ createdAt: 1, _id: 1 }).lean();
  console.log(`=== Total Channels in DB: ${channels.length} ===\n`);

  console.log("--- All Channels by creation date / insertion ---");
  channels.forEach((c, idx) => {
    const created = c.createdAt ? new Date(c.createdAt).toISOString() : "No createdAt";
    console.log(`${(idx + 1).toString().padStart(2)}. @${c.username.padEnd(25)} | Created: ${created} | TotalIndexed: ${c.totalIndexed} | Active: ${c.active} | Health: ${c.healthStatus}`);
  });

  // Check specifically for keleme_2013, freshman_materials or matches
  console.log("\n--- Specific Channels Check ---");
  const specificUsernames = ["keleme_2013", "freshman_materials", "freshman", "keleme"];
  for (const name of specificUsernames) {
    const matches = await TelegramChannel.find({ username: new RegExp(name, "i") }).lean();
    console.log(`Query regex "${name}": found ${matches.length} channels:`, matches.map(m => `@${m.username}`));
  }

  // Also check TelegramResource for distinct channelUsernames to see if there are resources from channels NOT in TelegramChannel collection
  const distinctResourceChannels = await TelegramResource.distinct("channelUsername");
  console.log(`\nTotal distinct channelUsernames in TelegramResource: ${distinctResourceChannels.length}`);
  const channelUsernamesInModel = new Set(channels.map(c => c.username.toLowerCase().replace(/^@/, '')));
  const missingFromChannelsTable = distinctResourceChannels.filter(c => !channelUsernamesInModel.has(c.toLowerCase().replace(/^@/, '')));
  console.log("Channels in Resources but NOT in TelegramChannel table:", missingFromChannelsTable);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
