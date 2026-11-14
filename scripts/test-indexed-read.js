require('dotenv').config();
const mongoose = require('mongoose');

async function testIndex() {
  await mongoose.connect(process.env.MONGO_URI);
  console.time('count isExam:true');
  const countTrue = await mongoose.connection.collection('telegramresources').countDocuments({
    isExam: true,
    fileType: 'image',
    groupId: { $ne: null },
    isAvailable: { $ne: false }
  });
  console.timeEnd('count isExam:true');

  console.time('count isExam:false');
  const countFalse = await mongoose.connection.collection('telegramresources').countDocuments({
    isExam: false,
    fileType: 'image',
    groupId: { $ne: null },
    isAvailable: { $ne: false }
  });
  console.timeEnd('count isExam:false');

  console.log(`True: ${countTrue}, False: ${countFalse}`);
  await mongoose.disconnect();
}
testIndex().catch(console.error);
