require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function removeCryptoSpam() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await TelegramResource.deleteMany({
    $or: [
      { caption: /AVACOIN/i },
      { caption: /Notcoin/i },
      { cleanTitle: /AVACOIN/i }
    ]
  });
  console.log(`Deleted ${result.deletedCount} crypto spam resources`);
  await mongoose.disconnect();
}
removeCryptoSpam().catch(console.error);
