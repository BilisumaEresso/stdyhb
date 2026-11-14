require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const filter = {
    isAvailable: true,
    $or: [{ groupId: null }, { groupIndex: 1 }, { groupIndex: { $exists: false } }]
  };
  const count = await TelegramResource.countDocuments(filter);
  console.log("Total explore browse items (single files + 1 card per bundle):", count);

  const sample = await TelegramResource.find(filter).limit(5).lean();
  console.log("Sample explore cards:");
  sample.forEach(s => console.log(`  title: "${s.cleanTitle || s.fileName}" | groupId: ${s.groupId} | idx: ${s.groupIndex} | total: ${s.groupTotal}`));

  await mongoose.disconnect();
}
test().catch(console.error);
