require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function buildIndex() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Building index { fileName: 1, fileSize: 1 }...");
  await TelegramResource.collection.createIndex({ fileName: 1, fileSize: 1 }, { background: true });
  console.log("✅ Index created successfully!");
  await mongoose.disconnect();
}
buildIndex().catch(console.error);
