require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await mongoose.connection.collection('telegramresources').indexes();
  console.log('INDEXES:', JSON.stringify(indexes, null, 2));
  await mongoose.disconnect();
}
checkIndexes().catch(console.error);
