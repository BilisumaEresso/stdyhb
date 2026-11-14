require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function restore() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Restoring clustered legacy albums to isAvailable: true...");

  const res = await TelegramResource.updateMany(
    { groupId: /^leg_/, isAvailable: false },
    { $set: { isAvailable: true } }
  );

  console.log(`✅ Restored ${res.modifiedCount} clustered resources to isAvailable: true`);

  await mongoose.disconnect();
}
restore().catch(console.error);
