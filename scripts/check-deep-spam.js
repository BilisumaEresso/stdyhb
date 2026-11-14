require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function auditSpam() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Look for promotional patterns: "ክፍያ", "ዋጋ", "ይመዝገቡ", "register", "payment", "bank", "cbe"
  const promoKeywords = [
    /ክፍያ/i,
    /ይመዝገቡ/i,
    /ለመመዝገብ/i,
    /የኮርስ ዋጋ/i,
    /MasterClass/i,
    /Master Class/i,
    /ExamClass/i,
    /VIP/i,
    /Discount/i,
    /ቴሌግራም ቦት/i
  ];

  console.log("=== Checking potential commercial promo resources ===");
  for (const regex of promoKeywords) {
    const count = await TelegramResource.countDocuments({
      isAvailable: { $ne: false },
      $or: [
        { caption: regex },
        { cleanTitle: regex }
      ]
    });
    console.log(`Pattern ${regex}: ${count} available resources`);
  }

  // Sample image resources matching promo keywords (since photos are frequently ads)
  const imagePromos = await TelegramResource.find({
    isAvailable: { $ne: false },
    fileType: 'image',
    $or: [
      { caption: /ይመዝገቡ/i },
      { caption: /ለመመዝገብ/i },
      { caption: /ክፍያ/i },
      { caption: /Master Class/i },
      { caption: /ExamClass/i }
    ]
  }).select('cleanTitle caption channelUsername messageId').limit(20);

  console.log(`\nFound ${imagePromos.length} sample image promotional resources:`);
  imagePromos.forEach(p => {
    console.log(`- [${p._id}] @${p.channelUsername}/${p.messageId}: "${p.cleanTitle}"`);
    console.log(`  Caption: ${(p.caption || '').replace(/\r?\n/g, ' ').slice(0, 100)}...`);
  });

  await mongoose.disconnect();
}
auditSpam().catch(console.error);
