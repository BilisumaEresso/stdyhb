require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramChannel = require("../src/db/models/TelegramChannel");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("=== Group Index Distribution ===");
  const countIndex0 = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: 0 });
  const countIndex1 = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: 1 });
  const countTotalGrouped = await TelegramResource.countDocuments({ groupId: { $ne: null } });
  const countUngrouped = await TelegramResource.countDocuments({ groupId: null });

  console.log(`Total grouped resources: ${countTotalGrouped}`);
  console.log(`Total ungrouped resources: ${countUngrouped}`);
  console.log(`Grouped resources with groupIndex: 0 => ${countIndex0}`);
  console.log(`Grouped resources with groupIndex: 1 => ${countIndex1}`);

  // Distinct groupIndex values
  const distinctGroupIndices = await TelegramResource.distinct("groupIndex", { groupId: { $ne: null } });
  console.log("Distinct groupIndex values in DB:", distinctGroupIndices.sort((a,b)=>a-b));

  // Check how many groups have groupIndex: 0 vs 1
  console.log("\n=== Checking Sample Group Records ===");
  const sampleGrouped = await TelegramResource.find({ groupId: { $ne: null } }).limit(5).lean();
  sampleGrouped.forEach(r => {
    console.log(`id: ${r._id} | ch: @${r.channelUsername} | groupId: ${r.groupId} | groupIndex: ${r.groupIndex} | groupTotal: ${r.groupTotal} | title: "${r.cleanTitle || r.fileName}"`);
  });

  await mongoose.disconnect();
}
check().catch(console.error);
