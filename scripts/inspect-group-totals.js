const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');
  
  const hasGroupTotal = await col.countDocuments({ groupId: { $ne: null }, groupTotal: { $exists: true, $ne: null } });
  const missingGroupTotal = await col.countDocuments({ groupId: { $ne: null }, $or: [{ groupTotal: null }, { groupTotal: { $exists: false } }] });
  console.log('Albums with groupTotal:', hasGroupTotal);
  console.log('Albums without groupTotal:', missingGroupTotal);

  // Also check if any groupIndex is 0
  const groupIndexZero = await col.countDocuments({ groupIndex: 0 });
  console.log('Documents with groupIndex === 0:', groupIndexZero);

  await mongoose.disconnect();
})();
