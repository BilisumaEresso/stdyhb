const { MongoClient } = require("mongodb");

async function checkDuplicatesInDb() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", { family: 4 });
  await client.connect();
  const db = client.db("studyhub_isolated_restore_test_20261113");
  const col = db.collection("telegramresources");

  // Find sample duplicates with same fileUniqueId
  const dupes = await col.aggregate([
    { $match: { fileUniqueId: { $exists: true, $ne: "" }, groupId: null } },
    { $group: { _id: "$fileUniqueId", count: { $sum: 1 }, channels: { $addToSet: "$channelUsername" }, fileNames: { $addToSet: "$fileName" } } },
    { $match: { count: { $gt: 2 } } },
    { $limit: 5 }
  ]).toArray();

  console.log("Sample standalone duplicate clusters in DB:");
  dupes.forEach((d, i) => {
    console.log(`\nCluster ${i + 1}: fileUniqueId=${d._id} (${d.count} copies across channels: ${d.channels.join(", ")})`);
    console.log(`  File names: ${d.fileNames.join(", ")}`);
  });

  await client.close();
}

checkDuplicatesInDb().catch(console.error);
