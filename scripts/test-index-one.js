require("dotenv").config();
const mongoose = require("mongoose");
const { indexChannel } = require("../src/search/telegramIndexer");
const TelegramResource = require("../src/db/models/TelegramResource");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected\n");

  // Start with this one — it's high priority and general
  await indexChannel("temariLiqacademy", 300);

  const count = await TelegramResource.countDocuments();
  const sample = await TelegramResource.find().limit(3).lean();

  console.log(`\nTotal resources in DB: ${count}`);
  console.log("\nSample results:");
  sample.forEach((r) => {
    console.log(
      `  - [${r.fileType}] ${r.fileName || r.caption?.slice(0, 50)} | tags: ${r.tags.join(", ")}`,
    );
  });

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(console.error);
