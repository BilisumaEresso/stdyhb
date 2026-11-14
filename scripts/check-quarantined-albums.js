require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const count = await TelegramResource.countDocuments({
    groupId: { $ne: null },
    isAvailable: false
  });
  console.log("Grouped resources with isAvailable: false =>", count);

  // How many of them are newly clustered legacy groups (groupId starts with "leg_")?
  const legacyCount = await TelegramResource.countDocuments({
    groupId: /^leg_/,
    isAvailable: false
  });
  console.log("Legacy clustered resources with isAvailable: false =>", legacyCount);

  await mongoose.disconnect();
}
check().catch(console.error);
