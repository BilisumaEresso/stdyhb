require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

const PROMO_PATTERNS = [
  // Specific targets mentioned by user
  /ExamClass/i,
  /Freshman\s*Master\s*Class/i,
  /@ExamClass_RegBot/i,
  /@FreshmanMasterClassBot/i,
  /@FreshmanMasterClass_Admin/i,
  /Qeleme\s*ExamClass/i,
  /@qeleme_examclass/i,

  // Commercial bots & registration ads
  /\b(RegBot|RegistrationBot|MasterClassBot)\b/i,
  /ክፍያ\s*አንዴ\s*ብቻ\s*ከፍላ/i,
  /ኮርስ\s*ለመግዛት/i,
  /ተማሪን\s*ባማከለ\s*ክፍያ/i,
  /ስልጠና\s*እንሰጣለን/i,
  /የ\s*ምዝገባ\s*ክፍያ/i,
  /VIP\s*channel|VIP\s*group|paid\s*channel|subscription\s*fee/i,
  /ፈተና\s*እንሸጣለን|መልስ\s*ለመግዛት/i
];

async function scanPromo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Scanning for Commercial / Promo Ads in TelegramResource ===");

  const query = {
    $or: [
      { caption: { $regex: /ExamClass|Freshman\s*Master\s*Class|RegBot|MasterClassBot|ባማከለ\s*ክፍያ|ኮርስ\s*ለመግዛት/i } },
      { cleanTitle: { $regex: /ExamClass|Freshman\s*Master\s*Class/i } }
    ]
  };

  const matches = await TelegramResource.find(query).select("_id channelUsername messageId fileType fileName fileSize cleanTitle caption tags").lean();
  console.log(`Found ${matches.length} resources matching commercial/promo signatures.\n`);

  // Count by channel and fileType
  const byChan = {};
  const byType = {};
  matches.forEach(m => {
    byChan[m.channelUsername] = (byChan[m.channelUsername] || 0) + 1;
    byType[m.fileType] = (byType[m.fileType] || 0) + 1;
  });

  console.log("Matches by channel:", byChan);
  console.log("Matches by fileType:", byType);

  console.log("\nSample 10 Promo Items:");
  matches.slice(0, 10).forEach((m, i) => {
    console.log(`[${i + 1}] ID: ${m._id} | @${m.channelUsername} msg: ${m.messageId} | type: ${m.fileType} | size: ${m.fileSize}`);
    console.log(`    cleanTitle: "${m.cleanTitle}"`);
    console.log(`    caption: "${(m.caption || '').replace(/\r?\n/g, ' ').slice(0, 80)}..."\n`);
  });

  await mongoose.disconnect();
}

scanPromo().catch(console.error);
