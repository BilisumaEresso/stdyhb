require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function checkMasterClass() {
  await mongoose.connect(process.env.MONGO_URI);
  const mc = await TelegramResource.find({
    isAvailable: { $ne: false },
    $or: [
      { caption: /Master Class/i },
      { cleanTitle: /Master Class/i }
    ]
  }).select('cleanTitle caption channelUsername messageId fileType');
  console.log('Master Class resources:', mc);

  // Check crypto/airdrop spam: AVACOIN, Blum, Notcoin, tap to earn, etc.
  const crypto = await TelegramResource.find({
    isAvailable: { $ne: false },
    $or: [
      { caption: /AVACOIN/i },
      { caption: /Notcoin/i },
      { caption: /airdrop/i },
      { caption: /tap to earn/i },
      { cleanTitle: /AVACOIN/i }
    ]
  }).select('cleanTitle caption channelUsername messageId fileType');
  console.log(`Crypto spam count: ${crypto.length}`);
  crypto.forEach(c => console.log(`- [${c._id}] @${c.channelUsername}/${c.messageId}: "${c.cleanTitle}"`));

  await mongoose.disconnect();
}
checkMasterClass().catch(console.error);
