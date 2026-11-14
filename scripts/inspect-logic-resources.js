require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function inspectLogicResources() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic', 'freshmanebook'];

  for (const ch of channels) {
    const items = await TelegramResource.find({
      channelUsername: ch,
      isAvailable: { $ne: false },
      $or: [
        { fileName: /logic/i },
        { cleanTitle: /logic/i },
        { caption: /logic/i }
      ]
    }).sort({ messageId: 1 }).select('messageId fileName cleanTitle caption fileSize groupId groupIndex groupTotal isExam');

    console.log(`\n================================================================`);
    console.log(`Channel @${ch}: ${items.length} "logic" resources`);
    console.log(`================================================================`);
    
    // Group by (fileName, fileSize)
    const fileMap = new Map();
    items.forEach(it => {
      const fn = (it.fileName || it.cleanTitle || "").toLowerCase().trim();
      const sz = it.fileSize || 0;
      const key = `${fn}::${sz}`;
      if (!fileMap.has(key)) fileMap.set(key, []);
      fileMap.get(key).push(it);
    });

    console.log(`Unique file signatures: ${fileMap.size}`);
    fileMap.forEach((list, key) => {
      if (list.length > 1) {
        console.log(`\n  ⚠️ DUPLICATE FILE (${list.length} copies): ${key}`);
        list.forEach(item => {
          console.log(`    - ID: ${item._id} | msg: ${item.messageId} | groupId: ${item.groupId} | grpIdx: ${item.groupIndex}/${item.groupTotal} | title: "${item.cleanTitle}"`);
        });
      } else {
        const item = list[0];
        console.log(`  ✓ Single: msg ${item.messageId} | size ${item.fileSize} | groupId: ${item.groupId} | "${item.cleanTitle}"`);
      }
    });
  }

  await mongoose.disconnect();
}
inspectLogicResources().catch(console.error);
