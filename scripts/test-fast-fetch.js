require('dotenv').config();
const mongoose = require('mongoose');

async function testFetch() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');
  console.time('fetch isExam:false');
  const falseDocs = await mongoose.connection.collection('telegramresources')
    .find({
      isExam: false,
      fileType: 'image',
      groupId: { $ne: null },
      isAvailable: { $ne: false }
    }, {
      projection: { _id: 1, caption: 1, channelUsername: 1, groupId: 1, groupTotal: 1, archiveMessageId: 1, messageId: 1 }
    })
    .hint('isExam_1_fileType_1')
    .toArray();
  console.timeEnd('fetch isExam:false');
  console.log('Loaded falseDocs:', falseDocs.length);

  console.time('fetch isExam:true');
  const trueDocs = await mongoose.connection.collection('telegramresources')
    .find({
      isExam: true,
      fileType: 'image',
      groupId: { $ne: null },
      isAvailable: { $ne: false }
    }, {
      projection: { _id: 1, caption: 1, channelUsername: 1, groupId: 1, groupTotal: 1, archiveMessageId: 1, messageId: 1 }
    })
    .hint('isExam_1_fileType_1')
    .toArray();
  console.timeEnd('fetch isExam:true');
  console.log('Loaded trueDocs:', trueDocs.length);

  await mongoose.disconnect();
}

testFetch().catch(console.error);
