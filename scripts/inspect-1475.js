require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await TelegramResource.findOne({ channelUsername: "Exit_Exam_Questions", messageId: 1475 }).lean();
  console.log("Document 1475:", {
    _id: r._id,
    channelUsername: r.channelUsername,
    messageId: r.messageId,
    fileType: r.fileType,
    fileName: r.fileName,
    cleanTitle: r.cleanTitle,
    caption: r.caption,
    tags: r.tags,
    groupId: r.groupId,
    groupIndex: r.groupIndex,
    groupTotal: r.groupTotal,
    fileUniqueId: r.fileUniqueId
  });

  // What about messages around 1475 in Exit_Exam_Questions?
  const nearby = await TelegramResource.find({
    channelUsername: "Exit_Exam_Questions",
    messageId: { $gte: 1470, $lte: 1485 }
  }).lean();

  console.log(`\nFound ${nearby.length} resources around msgId 1475 in @Exit_Exam_Questions:`);
  nearby.forEach(m => {
    console.log(`  msgId: ${m.messageId} | type: ${m.fileType} | grp: ${m.groupId} | title: "${m.cleanTitle || m.fileName}" | cap: "${(m.caption || '').replace(/\r?\n/g, ' ').slice(0, 50)}..."`);
  });

  await mongoose.disconnect();
}
run().catch(console.error);
