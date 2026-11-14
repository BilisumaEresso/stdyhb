require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkGlobalClusters() {
  await mongoose.connect(process.env.MONGO_URI);

  const totalUngrouped = await TelegramResource.countDocuments({ groupId: null });
  console.log(`Total ungrouped resources across entire DB: ${totalUngrouped}`);

  // Count by fileType
  const ungroupedImages = await TelegramResource.countDocuments({ groupId: null, fileType: "image" });
  const ungroupedPdfs = await TelegramResource.countDocuments({ groupId: null, fileType: "pdf" });
  const ungroupedPpts = await TelegramResource.countDocuments({ groupId: null, fileType: "ppt" });
  const ungroupedDocs = await TelegramResource.countDocuments({ groupId: null, fileType: "doc" });

  console.log(`  Ungrouped Images : ${ungroupedImages}`);
  console.log(`  Ungrouped PDFs   : ${ungroupedPdfs}`);
  console.log(`  Ungrouped PPTs   : ${ungroupedPpts}`);
  console.log(`  Ungrouped Docs   : ${ungroupedDocs}`);

  await mongoose.disconnect();
}
checkGlobalClusters().catch(console.error);
