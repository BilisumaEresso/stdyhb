require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function removeSpam() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Removing Commercial Promo Spam From Database ===");

  const filter = {
    $or: [
      { _id: new mongoose.Types.ObjectId("6a3bd2ec8a01628c85784a68") },
      { _id: new mongoose.Types.ObjectId("6ad6b23b0f435c634e836361") },
      {
        fileType: "image",
        caption: {
          $regex: /ExamClass_RegBot|FreshmanMasterClassBot|FreshmanMasterClass_Admin|ባማከለ\s*ክፍያ|ኮርስ\s*ለመግዛት|ስልጠና\s*እንሰጣለን|MalefiaTrainingInstitute|ለመመዝገብ\s*@\w+Bot/i
        }
      },
      {
        fileType: "image",
        cleanTitle: { $regex: /ExamClass.*Second\s*ሴሚስተር|Freshman\s*Master\s*Class/i }
      }
    ]
  };

  const count = await TelegramResource.countDocuments(filter);
  console.log(`Matched ${count} commercial spam items.`);

  const res = await TelegramResource.deleteMany(filter);
  console.log(`✅ Permanently deleted ${res.deletedCount} commercial spam items from TelegramResource.`);

  await mongoose.disconnect();
}
removeSpam().catch(console.error);
