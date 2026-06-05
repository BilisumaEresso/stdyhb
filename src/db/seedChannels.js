require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("./models/TelegramChannel");

const channels = [
  // Add real Ethiopian university channels you know here
  {
    username: "astu_resources",
    university: "ASTU",
    department: "General",
    type: "general",
    priority: 3,
  },
  {
    username: "astu_cs",
    university: "ASTU",
    department: "CS",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "astu_se",
    university: "ASTU",
    department: "SE",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "aau_engineering",
    university: "AAU",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "ethiopia_exam_files",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 2,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Seeding channels...");

  for (const ch of channels) {
    await TelegramChannel.updateOne(
      { username: ch.username },
      { $set: ch },
      { upsert: true },
    );
    console.log(`✅ ${ch.username}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(console.error);
