require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function inspectSpam() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Inspecting Commercial Spam in TelegramResource ===");

  const filter = {
    $or: [
      { _id: new mongoose.Types.ObjectId("6a3bd2ec8a01628c85784a68") },
      { _id: new mongoose.Types.ObjectId("6ad6b23b0f435c634e836361") },
      {
        fileType: "image",
        caption: {
          $regex: /ExamClass_RegBot|FreshmanMasterClassBot|FreshmanMasterClass_Admin|ባማከለ\s*ክፍያ|ኮርስ\s*ለመግዛት|ስልጠና\s*እንሰጣለን|MalefiaTrainingInstitute/i
        }
      },
      {
        cleanTitle: { $regex: /ExamClass.*Second\s*ሴሚስተር|Freshman\s*Master\s*Class/i }
      }
    ]
  };

  const matches = await TelegramResource.find(filter).lean();
  console.log(`Found ${matches.length} commercial spam items to permanently delete:`);
  matches.forEach((m, idx) => {
    console.log(`[${idx + 1}] ID: ${m._id} | @${m.channelUsername} | type: ${m.fileType} | title: "${m.cleanTitle}"`);
    console.log(`    caption: "${(m.caption || '').replace(/\r?\n/g, ' ').slice(0, 80)}..."`);
  });

  await mongoose.disconnect();
}
inspectSpam().catch(console.error);
