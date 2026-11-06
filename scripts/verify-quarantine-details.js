require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResourceQuarantine = require('../src/db/models/TelegramResourceQuarantine');
const TelegramResource = require('../src/db/models/TelegramResource');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const totalQuarantined = await TelegramResourceQuarantine.countDocuments();
  console.log('Total in Quarantine collection:', totalQuarantined);

  const byReason = await TelegramResourceQuarantine.aggregate([
    { $group: { _id: '$quarantineReason', count: { $sum: 1 } } }
  ]);
  console.log('By Reason:', byReason);

  // Check the OOP document
  const oopDoc = await TelegramResource.findOne({ fileName: /Chapter -1-OOP concepts/i }).lean();
  console.log('\nOOP Doc in TelegramResource:');
  console.log('  fileName:', oopDoc?.fileName);
  console.log('  isAvailable:', oopDoc?.isAvailable);
  console.log('  caption:', oopDoc?.caption);

  const oopQuarantine = await TelegramResourceQuarantine.findOne({ fileName: /Chapter -1-OOP concepts/i }).lean();
  console.log('\nOOP Doc in Quarantine:');
  console.log('  found:', !!oopQuarantine);
  if (oopQuarantine) {
    console.log('  quarantineReason:', oopQuarantine.quarantineReason);
    console.log('  quarantineDetail:', oopQuarantine.quarantineDetail);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
