require("dotenv").config();
const mongoose = require("mongoose");
const { indexAllChannels } = require("../src/search/telegramIndexer");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected\n");

  await indexAllChannels();

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(console.error);
