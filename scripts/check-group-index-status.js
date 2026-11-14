require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function checkGroupIndexStatus() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const totalGrouped = await TelegramResource.countDocuments({ groupId: { $ne: null } });
  const groupedWithIndex1 = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: 1 });
  const groupedWithOtherIndex = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: { $gt: 1 } });
  const groupedWithIndex0 = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: 0 });
  const groupedWithNullIndex = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: null });
  const groupedWithoutIndex = await TelegramResource.countDocuments({ groupId: { $ne: null }, groupIndex: { $exists: false } });

  console.log(`=== Grouped Resources groupIndex Status ===`);
  console.log(`Total grouped resources: ${totalGrouped}`);
  console.log(`Grouped with groupIndex === 1: ${groupedWithIndex1}`);
  console.log(`Grouped with groupIndex > 1: ${groupedWithOtherIndex}`);
  console.log(`Grouped with groupIndex === 0: ${groupedWithIndex0}`);
  console.log(`Grouped with groupIndex === null: ${groupedWithNullIndex}`);
  console.log(`Grouped without groupIndex field: ${groupedWithoutIndex}`);

  // Specifically check in freshman_materials, keleme_2013, ethioacadamic
  for (const ch of ['freshman_materials', 'keleme_2013', 'ethioacadamic']) {
    const unindexedGroups = await TelegramResource.countDocuments({
      channelUsername: ch,
      groupId: { $ne: null },
      $or: [{ groupIndex: null }, { groupIndex: { $exists: false } }, { groupIndex: 0 }]
    });
    console.log(`@${ch}: grouped items with missing/null/0 groupIndex: ${unindexedGroups}`);
  }

  await mongoose.disconnect();
}
checkGroupIndexStatus().catch(console.error);
