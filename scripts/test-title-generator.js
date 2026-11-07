require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { generateDisplayTitle } = require("../src/utils/titleGenerator");

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for Title Generator Test.\n");

  // Fetch samples across all types: PDFs, PPTs, DOCs, and Photo Albums
  const samples = await TelegramResource.find({ isAvailable: { $ne: false } })
    .select("fileName caption fileType groupId groupTotal courseCode tags downloadCount")
    .sort({ downloadCount: -1 })
    .limit(40)
    .lean();

  console.log("====================================================");
  console.log("TITLE GENERATION EVALUATION (TOP 40 SAMPLES)");
  console.log("====================================================\n");

  samples.forEach((s, i) => {
    const generated = generateDisplayTitle(s);
    const rawName = s.fileName || "[EMPTY FILE NAME]";
    const rawCap = (s.caption || "").substring(0, 50).replace(/\n/g, " ") || "[EMPTY CAPTION]";
    console.log(`${i + 1}. [${s.fileType.toUpperCase()}] dl=${s.downloadCount || 0} grp=${s.groupId ? "Y" : "N"}`);
    console.log(`   RAW FILE:    "${rawName}"`);
    console.log(`   RAW CAPTION: "${rawCap}"`);
    console.log(`   ✨ CLEAN:    "${generated}"`);
    console.log("----------------------------------------------------");
  });

  await mongoose.disconnect();
}

test().catch(console.error);
