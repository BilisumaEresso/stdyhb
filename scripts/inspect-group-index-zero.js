const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');
  
  const sample = await col.find({ groupIndex: 0 }).limit(5).toArray();
  console.log('Sample groupIndex: 0 ->', sample.map(s => ({
    _id: s._id,
    groupId: s.groupId,
    groupIndex: s.groupIndex,
    groupTotal: s.groupTotal,
    fileName: s.fileName,
    fileType: s.fileType,
    cleanTitle: s.cleanTitle
  })));

  const countWithGroupId = await col.countDocuments({ groupIndex: 0, groupId: { $ne: null } });
  const countWithNullGroupId = await col.countDocuments({ groupIndex: 0, groupId: null });
  console.log('groupIndex: 0 with groupId != null:', countWithGroupId);
  console.log('groupIndex: 0 with groupId == null:', countWithNullGroupId);

  await mongoose.disconnect();
})();
