const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const col = mongoose.connection.db.collection('telegramresources');
  
  const albumDoc = await col.findOne({ groupId: { $ne: null } });
  console.log('Album doc fields:', Object.keys(albumDoc));
  console.log('Album doc sample:', {
    _id: albumDoc._id,
    fileName: albumDoc.fileName,
    cleanTitle: albumDoc.cleanTitle,
    groupId: albumDoc.groupId,
    groupIndex: albumDoc.groupIndex,
    groupCount: albumDoc.groupCount,
    isAlbum: albumDoc.isAlbum,
    fileType: albumDoc.fileType,
    isExam: albumDoc.isExam,
    caption: albumDoc.caption
  });

  const sameGroup = await col.find({ groupId: albumDoc.groupId }).toArray();
  console.log(`Same group (${albumDoc.groupId}) has ${sameGroup.length} items with groupIndices:`, sameGroup.map(x => x.groupIndex));

  await mongoose.disconnect();
})();
