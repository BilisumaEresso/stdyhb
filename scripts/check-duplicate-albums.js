require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkDuplicateAlbumsAcrossDb() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Auditing Duplicate Image Albums (Same Channel + Same Caption/Title) ===");

  const albums = await TelegramResource.aggregate([
    {
      $match: {
        isAvailable: { $ne: false },
        fileType: "image",
        groupId: { $ne: null },
        groupIndex: 1,
        caption: { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: {
          channelUsername: "$channelUsername",
          captionPrefix: {
            $substrCP: [
              { $toLower: { $trim: { input: "$caption" } } },
              0,
              60
            ]
          }
        },
        count: { $sum: 1 },
        groupIds: { $push: "$groupId" },
        msgIds: { $push: "$messageId" },
        titles: { $push: "$cleanTitle" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`Found ${albums.length} duplicate image album groups across all channels.`);
  let redundantAlbums = 0;
  albums.forEach(a => {
    redundantAlbums += (a.count - 1);
  });
  console.log(`Total redundant duplicate albums: ${redundantAlbums}`);

  // Count how many individual photo documents are in those redundant albums
  const redundantGroupIds = [];
  for (const a of albums) {
    // Keep newest msgId's groupId as canonical, mark older groupIds as redundant
    const sorted = a.groupIds.map((g, i) => ({ g, msg: a.msgIds[i] })).sort((x, y) => y.msg - x.msg);
    for (let i = 1; i < sorted.length; i++) {
      redundantGroupIds.push(sorted[i].g);
    }
  }

  const redundantPhotosCount = await TelegramResource.countDocuments({
    groupId: { $in: redundantGroupIds },
    isAvailable: { $ne: false }
  });

  console.log(`Total redundant photo documents to be pruned: ${redundantPhotosCount}`);

  await mongoose.disconnect();
}
checkDuplicateAlbumsAcrossDb().catch(console.error);
