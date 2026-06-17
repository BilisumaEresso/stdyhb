require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramChannel = require("../src/db/models/TelegramChannel");
const SavedResource = require("../src/db/models/SavedResource");

async function stats() {
  await mongoose.connect(process.env.MONGO_URI);

  const total = await TelegramResource.countDocuments();
  const exams = await TelegramResource.countDocuments({ isExam: true });
  const pdfs = await TelegramResource.countDocuments({ fileType: "pdf" });
  const ppts = await TelegramResource.countDocuments({ fileType: "ppt" });
  const images = await TelegramResource.countDocuments({ fileType: "image" });
  
  const activeChannels = await TelegramChannel.countDocuments({ active: true, healthStatus: "ACTIVE" });
  const degradedChannels = await TelegramChannel.countDocuments({ healthStatus: "DEGRADED" });
  const deadChannels = await TelegramChannel.countDocuments({ healthStatus: "DEAD" });
  
  const savedResources = await SavedResource.countDocuments();

  // Find DB Size
  const dbStats = await mongoose.connection.db.stats();
  const dbSizeMB = (dbStats.dataSize / (1024 * 1024)).toFixed(2);

  // Find last scan
  const mostRecentScan = await TelegramChannel.findOne({ lastScannedAt: { $ne: null } })
    .sort({ lastScannedAt: -1 })
    .select("lastScannedAt");

  const topIndexed = await TelegramChannel.find({ totalIndexed: { $gt: 0 } })
    .sort({ totalIndexed: -1 })
    .limit(5)
    .select("username totalIndexed");

  console.log("=== StudyHub DB Stats ===\n");
  console.log(`Total resources : ${total}`);
  console.log(`Exams           : ${exams}`);
  console.log(`PDFs            : ${pdfs}`);
  console.log(`PPTs            : ${ppts}`);
  console.log(`Images          : ${images}`);
  console.log(`Saved Resources : ${savedResources}`);
  console.log(``);
  console.log(`Channels ACTIVE   : ${activeChannels}`);
  console.log(`Channels DEGRADED : ${degradedChannels}`);
  console.log(`Channels DEAD     : ${deadChannels}`);
  console.log(``);
  console.log(`Estimated DB Size : ${dbSizeMB} MB`);
  console.log(`Last Indexing Run : ${mostRecentScan ? mostRecentScan.lastScannedAt.toISOString() : "Never"}`);

  console.log("\nTop 5 Channels by totalIndexed:");
  topIndexed.forEach((c, idx) => console.log(`  ${idx+1}. @${c.username.padEnd(20)} ${c.totalIndexed}`));

  await mongoose.disconnect();
}

stats().catch(console.error);
