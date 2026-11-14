const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');

  const filterCurrent = {
    isAvailable: true,
    $or: [{ groupId: null }, { groupIndex: 1 }, { groupIndex: { $exists: false } }]
  };
  const countCurrent = await col.countDocuments(filterCurrent);
  console.log('Total available entities in browse mode ->', countCurrent);

  // How many are standalone?
  const standalone = await col.countDocuments({ isAvailable: true, groupId: null });
  console.log('Standalone available ->', standalone);

  // How many are album reps?
  const albumReps = await col.countDocuments({ isAvailable: true, groupId: { $ne: null }, groupIndex: 1 });
  console.log('Album reps available ->', albumReps);

  console.log('Sum:', standalone + albumReps);

  await mongoose.disconnect();
})();
