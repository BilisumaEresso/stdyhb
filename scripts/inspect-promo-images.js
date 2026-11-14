require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkPromoImages() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Checking Promo Images ===");

  const promoImages = await TelegramResource.find({
    fileType: "image",
    $or: [
      { caption: { $regex: /ExamClass.*(?:RegBot|መቀበል\s*ጀመረ|ምዝገባ)/i } },
      { caption: { $regex: /Freshman\s*Master\s*Class|MasterClassBot|ባማከለ\s*ክፍያ/i } },
      { caption: { $regex: /RegBot|ለመመዝገብ\s*@\w+|ስልጠና\s*እንሰጣለን|ኮርስ\s*ለመግዛት/i } },
      { cleanTitle: { $regex: /ExamClass|Freshman\s*Master\s*Class/i } }
    ]
  }).select("_id channelUsername messageId cleanTitle caption tags").lean();

  console.log(`Found ${promoImages.length} promo images in DB.`);
  promoImages.slice(0, 15).forEach((m, i) => {
    console.log(`[${i + 1}] ID: ${m._id} | @${m.channelUsername} | title: "${m.cleanTitle}"`);
    console.log(`    caption: "${(m.caption || '').replace(/\r?\n/g, ' ').slice(0, 100)}..."`);
  });

  await mongoose.disconnect();
}
checkPromoImages().catch(console.error);
