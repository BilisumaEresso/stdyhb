require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkExactDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Checking Exact (fileName + fileSize) Duplicates in DB ===");

  // Find duplicates where fileName is not empty and fileSize > 0
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
        _id: { fileName: "$fileName", fileSize: "$fileSize" },
        count: { $sum: 1 },
        channels: { $addToSet: "$channelUsername" },
        ids: { $push: "$_id" }
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

  console.log(`Total duplicate groups found: ${duplicates.length}`);
  const totalDuplicateDocs = duplicates.reduce((sum, d) => sum + d.count, 0);
  const redundantDocs = totalDuplicateDocs - duplicates.length;
  console.log(`Total documents involved in duplicates: ${totalDuplicateDocs}`);
  console.log(`Redundant duplicate copies that can be pruned/collapsed: ${redundantDocs}`);

  console.log("\nTop 15 most duplicated files:");
  duplicates.slice(0, 15).forEach((d, i) => {
    console.log(`[${i + 1}] "${d._id.fileName}" (${(d._id.fileSize / (1024*1024)).toFixed(2)} MB)`);
    console.log(`    Found ${d.count} times across channels: [${d.channels.join(", ")}]`);
  });

  await mongoose.disconnect();
}
checkExactDuplicates().catch(console.error);
