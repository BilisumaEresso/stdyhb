const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');
  
  // Total unique groupIds
  const allGroupIds = await col.distinct('groupId', { groupId: { $ne: null } });
  console.log('Total unique groupIds:', allGroupIds.length);

  // GroupIds with groupIndex: 1
  const groupIdsWith1 = await col.distinct('groupId', { groupId: { $ne: null }, groupIndex: 1 });
  console.log('Total unique groupIds with groupIndex 1:', groupIdsWith1.length);

  // GroupIds with groupIndex: 0
  const groupIdsWith0 = await col.distinct('groupId', { groupId: { $ne: null }, groupIndex: 0 });
  console.log('Total unique groupIds with groupIndex 0:', groupIdsWith0.length);

  // How many groupIds do NOT have groupIndex 1?
  const diff = allGroupIds.filter(id => !groupIdsWith1.includes(id));
  console.log('GroupIds without groupIndex 1:', diff.length);
  if (diff.length > 0) {
    const sampleMissing = await col.find({ groupId: { $in: diff.slice(0, 5) } }).toArray();
    console.log('Sample items for groups without groupIndex 1:', sampleMissing.map(m => ({ groupId: m.groupId, groupIndex: m.groupIndex, fileName: m.fileName })));
  }

  // Check how many documents have groupIndex: { $exists: false } but have groupId != null
  const groupsNoIndex = await col.countDocuments({ groupId: { $ne: null }, groupIndex: { $exists: false } });
  console.log('Documents with groupId != null but groupIndex does not exist:', groupsNoIndex);

  await mongoose.disconnect();
})();
