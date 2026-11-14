require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkPdfs() {
  await mongoose.connect(process.env.MONGO_URI);
  const pdfs = await TelegramResource.find({
    fileType: "pdf",
    $or: [
      { caption: { $regex: /ExamClass|Freshman\s*Master\s*Class/i } },
      { fileName: { $regex: /ExamClass|Freshman\s*Master\s*Class/i } }
    ]
  }).select("fileName fileSize cleanTitle caption channelUsername").limit(20).lean();

  console.log(`=== Sample 20 PDFs matching ExamClass / Freshman Master Class ===`);
  pdfs.forEach((p, i) => {
    console.log(`[${i + 1}] @${p.channelUsername} | File: "${p.fileName}" | Size: ${p.fileSize} bytes`);
    console.log(`    Title: "${p.cleanTitle}"`);
    console.log(`    Cap: "${(p.caption || '').replace(/\r?\n/g, ' ').slice(0, 70)}..."\n`);
  });

  await mongoose.disconnect();
}
checkPdfs().catch(console.error);
