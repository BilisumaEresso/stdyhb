require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramChannel = require("../src/db/models/TelegramChannel");

async function stats() {
  await mongoose.connect(process.env.MONGO_URI);

  const total = await TelegramResource.countDocuments();
  const exams = await TelegramResource.countDocuments({ isExam: true });
  const pdfs = await TelegramResource.countDocuments({ fileType: "pdf" });
  const ppts = await TelegramResource.countDocuments({ fileType: "ppt" });
  const images = await TelegramResource.countDocuments({ fileType: "image" });
  const channels = await TelegramChannel.countDocuments({ active: true });

  // Top tags
  const tagAgg = await TelegramResource.aggregate([
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Per-channel counts
  const channelAgg = await TelegramResource.aggregate([
    { $group: { _id: "$channelUsername", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log("=== StudyHub DB Stats ===\n");
  console.log(`Total resources : ${total}`);
  console.log(`Exams           : ${exams}`);
  console.log(`PDFs            : ${pdfs}`);
  console.log(`PPTs            : ${ppts}`);
  console.log(`Images          : ${images}`);
  console.log(`Active channels : ${channels}`);

  console.log("\nTop tags:");
  tagAgg.forEach((t) => console.log(`  ${t._id.padEnd(20)} ${t.count}`));

  console.log("\nFiles per channel:");
  channelAgg.forEach((c) => console.log(`  @${c._id.padEnd(30)} ${c.count}`));

  await mongoose.disconnect();
}

stats().catch(console.error);
