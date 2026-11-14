require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const r1 = await TelegramResource.findById('6a3bd2ec8a01628c85784a68');
  const r2 = await TelegramResource.findById('6ad6b23b0f435c634e836361');
  console.log('ID 6a3bd2ec8a01628c85784a68 in DB?:', Boolean(r1));
  console.log('ID 6ad6b23b0f435c634e836361 in DB?:', Boolean(r2));
  
  const spam1 = await TelegramResource.countDocuments({
    $or: [
      { caption: /ExamClass_RegBot/i },
      { caption: /FreshmanMasterClassBot/i },
      { caption: /MalefiaTrainingInstitute/i },
      { cleanTitle: /ExamClass_RegBot/i }
    ]
  });
  console.log('Commercial spam bot count remaining:', spam1);

  const ecTitles = await TelegramResource.find({ cleanTitle: /ExamClass/i }).select('cleanTitle fileName fileType caption isAvailable').limit(10);
  console.log('Sample docs with ExamClass in title:');
  ecTitles.forEach(t => console.log(' - Avail:', t.isAvailable, '| Type:', t.fileType, '| File:', t.fileName, '| Title:', t.cleanTitle));

  await mongoose.disconnect();
}
test().catch(console.error);
