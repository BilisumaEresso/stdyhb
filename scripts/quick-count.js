require('dotenv').config();
const mongoose = require('mongoose');

async function f() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await mongoose.connection.collection('telegramresources').countDocuments({
    fileType: 'image',
    groupId: { $ne: null },
    isAvailable: { $ne: false }
  });
  console.log('Total active grouped images:', total);
  await mongoose.disconnect();
}
f().catch(console.error);
