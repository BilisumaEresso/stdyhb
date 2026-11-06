require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await TelegramResource.countDocuments();
  console.log('Total resources in DB:', total);

  const sample = await TelegramResource.find().sort({ _id: -1 }).limit(15).lean();
  console.log('\n--- 15 Most Recent Resources ---');
  sample.forEach((r, i) => {
    console.log(`[${i+1}] ID: ${r._id}`);
    console.log(`     Channel: @${r.channelUsername} | Type: ${r.fileType} | Exam: ${r.isExam} | Size: ${r.fileSize}`);
    console.log(`     Tags: [${(r.tags || []).join(', ')}] | Course: ${r.courseCode || 'none'} | Uni: ${r.university || 'none'}`);
    console.log(`     FileName: ${r.fileName || 'none'}`);
    console.log(`     Caption: ${(r.caption || '').replace(/\r?\n/g, ' ').substring(0, 100)}...`);
  });

  const noTags = await TelegramResource.countDocuments({ tags: { $size: 0 } });
  console.log('\nResources with 0 tags:', noTags);

  const onlyImages = await TelegramResource.countDocuments({ fileType: 'image' });
  console.log('Total images:', onlyImages);

  const totalExams = await TelegramResource.countDocuments({ isExam: true });
  console.log('Total exams marked:', totalExams);

  await mongoose.disconnect();
}
inspect().catch(console.error);
