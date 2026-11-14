require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkSameChannelDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Checking Intra-Channel (Same Channel + Same File + Same Size) Duplicates ===");

  const duplicates = await TelegramResource.aggregate([
    {
      $match: {
        fileName: { $ne: "" },
        fileSize: { $gt: 0 },
        isAvailable: { $ne: false }
      }
    },
    {
      $group: {
        _id: { channelUsername: "$channelUsername", fileName: "$fileName", fileSize: "$fileSize" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
        messageIds: { $push: "$messageId" }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  console.log(`Intra-channel duplicate file groups: ${duplicates.length}`);
  const totalInvolved = duplicates.reduce((s, d) => s + d.count, 0);
  const redundant = totalInvolved - duplicates.length;
  console.log(`Total documents involved: ${totalInvolved}`);
  console.log(`Redundant duplicate copies in the exact same channel: ${redundant}`);

  console.log("\nTop 10 intra-channel duplicates:");
  duplicates.slice(0, 10).forEach((d, i) => {
    console.log(`[${i + 1}] @${d._id.channelUsername} | "${d._id.fileName}" (${d._id.fileSize} bytes) | Posted ${d.count} times (msgIds: ${d.messageIds.join(", ")})`);
  });

  await mongoose.disconnect();
}
checkSameChannelDuplicates().catch(console.error);
