require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function checkAlbumNotices() {
  await mongoose.connect(process.env.MONGO_URI);

  const noticeRegex = /ምዝገባ|ቅበላ|የምዝገባ\s*ቀን|የቅበላ\s*ቀን|የተመደባችሁ|የጥሪ\s*ማስታወቂያ|registration\s*date|orientation\s*day|admitted\s*students|vacancy|ክፍት\s*የሥራ|entrance ticket/i;
  const adRegex = /telebirr|commercial bank|account number|ብር|ክፍያ|ዋጋ|vip\s*channel|betting|forex|crypto|airtime|giveaway/i;

  const albumsWithNotices = await TelegramResource.find({
    groupId: { $ne: null, $exists: true },
    caption: noticeRegex
  }).distinct('groupId');

  const albumsWithAds = await TelegramResource.find({
    groupId: { $ne: null, $exists: true },
    caption: adRegex
  }).distinct('groupId');

  console.log(`Total albums matching notice regex: ${albumsWithNotices.length}`);
  console.log(`Total albums matching ad regex: ${albumsWithAds.length}`);

  if (albumsWithNotices.length > 0) {
    console.log('\nSample Notice Albums:');
    for (const gId of albumsWithNotices.slice(0, 3)) {
      const item = await TelegramResource.findOne({ groupId: gId }).lean();
      console.log(`- [@${item.channelUsername}] Album ${gId}: "${item.caption?.substring(0, 100).replace(/\n/g, ' ')}"`);
    }
  }

  await mongoose.disconnect();
}
checkAlbumNotices().catch(console.error);
