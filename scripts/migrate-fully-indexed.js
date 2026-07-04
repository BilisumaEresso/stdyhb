require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("../src/db/models/TelegramChannel");

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 8000,
    });
    console.log("✅ Connected to MongoDB");

    // Set fullyIndexed = true for channels with totalIndexed > 0
    const fullyIndexedResult = await TelegramChannel.updateMany(
      { totalIndexed: { $gt: 0 } },
      { $set: { fullyIndexed: true } },
    );
    console.log(
      `✅ Set fullyIndexed: true on ${fullyIndexedResult.modifiedCount} channels with totalIndexed > 0`,
    );

    // Set fullyIndexed = false for channels with totalIndexed === 0
    const notIndexedResult = await TelegramChannel.updateMany(
      { totalIndexed: 0 },
      { $set: { fullyIndexed: false } },
    );
    console.log(
      `✅ Set fullyIndexed: false on ${notIndexedResult.modifiedCount} channels with totalIndexed === 0`,
    );

    // Display summary
    const fully = await TelegramChannel.countDocuments({ fullyIndexed: true });
    const notFully = await TelegramChannel.countDocuments({
      fullyIndexed: false,
    });
    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✅ Fully indexed channels: ${fully}`);
    console.log(`  ⏳ Channels pending full scan: ${notFully}`);

    console.log("\n✅ Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
