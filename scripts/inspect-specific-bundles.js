require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const msgs = [1475, 1494, 1530, 1559];
  const docs = await TelegramResource.find({ channelUsername: "Exit_Exam_Questions", messageId: { $in: msgs } }).lean();
  for (const d of docs) {
    console.log(`--- MsgId: ${d.messageId} | groupId: ${d.groupId} | groupTotal: ${d.groupTotal}`);
    console.log(`    cleanTitle: "${d.cleanTitle}" | fileName: "${d.fileName}"`);
    console.log(`    caption: "${(d.caption || '').replace(/\r?\n/g, ' ').slice(0, 80)}"`);
    console.log(`    fileUniqueId: ${d.fileUniqueId}`);
    const siblings = await TelegramResource.find({ groupId: d.groupId }).select("fileName cleanTitle fileUniqueId groupIndex").lean();
    console.log(`    group siblings count: ${siblings.length}`);
    siblings.forEach(s => console.log(`      idx:${s.groupIndex} name:"${s.fileName}" uniqueId:${s.fileUniqueId}`));
  }

  // Also check cross-channel duplication of these siblings: do these uniqueIds exist in other channels?
  if (docs.length > 0 && docs[0].groupId) {
    const siblings = await TelegramResource.find({ groupId: docs[0].groupId }).lean();
    for (const sib of siblings) {
      const sameFileElsewhere = await TelegramResource.find({ fileUniqueId: sib.fileUniqueId, _id: { $ne: sib._id } }).lean();
      console.log(`\nSibling "${sib.fileName}" (uniqueId: ${sib.fileUniqueId}) appears in other places: ${sameFileElsewhere.length}`);
      sameFileElsewhere.forEach(e => console.log(`  ch: @${e.channelUsername} | msgId: ${e.messageId} | groupId: ${e.groupId}`));
    }
  }

  await mongoose.disconnect();
}
inspect().catch(console.error);
