const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');
  
  console.log('Total:', await col.countDocuments());
  console.log('isAvailable: true ->', await col.countDocuments({ isAvailable: true }));
  console.log('isAvailable: { $ne: false } ->', await col.countDocuments({ isAvailable: { $ne: false } }));
  console.log('groupId != null ->', await col.countDocuments({ groupId: { $ne: null } }));
  console.log('isAvailable: true AND groupId != null ->', await col.countDocuments({ isAvailable: true, groupId: { $ne: null } }));
  
  const sampleAlbum = await col.find({ groupId: { $ne: null } }).limit(5).toArray();
  console.log('Sample album items:', sampleAlbum.map(a => ({ groupId: a.groupId, groupIndex: a.groupIndex, fileName: a.fileName, fileType: a.fileType, isAvailable: a.isAvailable })));
  
  const groupIndices = await col.aggregate([
    { $match: { groupId: { $ne: null } } },
    { $group: { _id: '$groupIndex', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 }
  ]).toArray();
  console.log('groupIndex distribution for albums:', groupIndices);
  
  // Also check how searchService.collapseGroupedResources handles albums
  await mongoose.disconnect();
})();
