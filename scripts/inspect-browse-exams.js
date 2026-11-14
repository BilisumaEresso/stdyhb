const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');

  const totalExams = await col.countDocuments({ isAvailable: true, isExam: true });
  console.log('isAvailable: true, isExam: true ->', totalExams);

  const filterCurrent = {
    isAvailable: true,
    $or: [{ groupId: null }, { groupIndex: 1 }, { groupIndex: { $exists: false } }],
    isExam: true
  };
  const countCurrent = await col.countDocuments(filterCurrent);
  console.log('Browse filter with isExam: true ->', countCurrent);

  const sampleExams = await col.find(filterCurrent).limit(5).toArray();
  console.log('Sample browse exams:', sampleExams.map(e => ({
    _id: e._id,
    fileName: e.fileName,
    cleanTitle: e.cleanTitle,
    groupId: e.groupId,
    groupIndex: e.groupIndex,
    groupTotal: e.groupTotal,
    isExam: e.isExam
  })));

  await mongoose.disconnect();
})();
