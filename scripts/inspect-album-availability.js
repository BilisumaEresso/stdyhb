const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');

  // Check if any album has mixed availability
  const mixedAvailability = await col.aggregate([
    { $match: { groupId: { $ne: null } } },
    { $group: { _id: '$groupId', statuses: { $addToSet: '$isAvailable' } } },
    { $match: { 'statuses.1': { $exists: true } } }
  ]).toArray();

  console.log('Albums with mixed availability:', mixedAvailability.length);

  // Check how many albums have isAvailable: true for groupIndex: 1
  const albumsWithGroupIndex1Available = await col.countDocuments({
    groupId: { $ne: null },
    groupIndex: 1,
    isAvailable: true
  });
  console.log('Albums with groupIndex: 1 and isAvailable: true ->', albumsWithGroupIndex1Available);

  const totalAlbumsAvailable = await col.distinct('groupId', {
    groupId: { $ne: null },
    isAvailable: true
  });
  console.log('Total distinct available albums ->', totalAlbumsAvailable.length);

  await mongoose.disconnect();
})();
