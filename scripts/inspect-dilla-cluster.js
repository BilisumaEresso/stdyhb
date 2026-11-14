require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await TelegramResource.find({
    channelUsername: "keleme_2013",
    messageId: { $in: [27, 28, 29] }
  }).lean();

  console.log("=== @keleme_2013 Messages 27, 28, 29 ===");
  items.forEach(item => {
    console.log({
      _id: item._id,
      messageId: item.messageId,
      groupId: item.groupId,
      groupIndex: item.groupIndex,
      groupTotal: item.groupTotal,
      fileType: item.fileType,
      fileName: item.fileName,
      cleanTitle: item.cleanTitle,
      caption: item.caption,
      fileUniqueId: item.fileUniqueId,
      messageDate: item.messageDate
    });
  });

  await mongoose.disconnect();
}
run().catch(console.error);
