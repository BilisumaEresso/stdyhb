require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const ids = ["6a3bd2ec8a01628c85784a68", "6ad6b23b0f435c634e836361"];
  const docs = await TelegramResource.find({ _id: { $in: ids } }).lean();
  console.log("=== Target Documents to Remove ===");
  docs.forEach(d => {
    console.log({
      _id: d._id,
      channelUsername: d.channelUsername,
      messageId: d.messageId,
      fileType: d.fileType,
      fileName: d.fileName,
      fileSize: d.fileSize,
      cleanTitle: d.cleanTitle,
      caption: d.caption,
      groupId: d.groupId,
      tags: d.tags,
      isExam: d.isExam
    });
  });

  await mongoose.disconnect();
}
check().catch(console.error);
