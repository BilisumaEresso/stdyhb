require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function checkMessageDates() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const ch of ['freshman_materials', 'keleme_2013', 'ethioacadamic']) {
    const withDate = await TelegramResource.countDocuments({ channelUsername: ch, messageDate: { $ne: null } });
    const withoutDate = await TelegramResource.countDocuments({ channelUsername: ch, messageDate: null });
    console.log(`@${ch}: with messageDate: ${withDate}, without messageDate: ${withoutDate}`);
  }
  await mongoose.disconnect();
}
checkMessageDates().catch(console.error);
