require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function analyzeCollection() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 8000,
    });
    console.log("✅ Connected to MongoDB\n");

    const totalResources = await TelegramResource.countDocuments();
    console.log(`📊 Total Resources: ${totalResources}\n`);

    // 1. Distribution by fileType
    console.log("📁 RESOURCES BY FILE TYPE");
    const fileTypeDistribution = await TelegramResource.aggregate([
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    for (const row of fileTypeDistribution) {
      const pct = ((row.count / totalResources) * 100).toFixed(1);
      console.log(`  ${row._id || "unknown"}: ${row.count} (${pct}%)`);
    }

    // 2. Exam vs Non-Exam by fileType
    console.log("\n📚 EXAMS VS NON-EXAMS BY FILE TYPE");
    const examDistribution = await TelegramResource.aggregate([
      {
        $group: {
          _id: {
            fileType: "$fileType",
            isExam: "$isExam",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.fileType": 1, "_id.isExam": -1 },
      },
    ]);

    let currentFileType = null;
    for (const row of examDistribution) {
      const { fileType, isExam } = row._id;
      if (fileType !== currentFileType) {
        console.log(`  ${fileType || "unknown"}:`);
        currentFileType = fileType;
      }
      console.log(
        `    ${isExam ? "✅ isExam: true" : "❌ isExam: false"}: ${row.count}`,
      );
    }

    // 3. Top 20 tags
    console.log("\n🏷️  TOP 20 MOST COMMON TAGS");
    const tagDistribution = await TelegramResource.aggregate([
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    for (const row of tagDistribution) {
      console.log(`  ${row._id}: ${row.count}`);
    }

    // 4. Top 10 channels by resource count
    console.log("\n📡 TOP 10 CHANNELS BY RESOURCE COUNT");
    const channelDistribution = await TelegramResource.aggregate([
      {
        $group: {
          _id: "$channelUsername",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    for (const row of channelDistribution) {
      console.log(`  @${row._id || "unknown"}: ${row.count}`);
    }

    // 5. Ungrouped, unsearchable resources (empty fileName AND empty caption)
    console.log("\n⚠️  UNGROUPED/UNSEARCHABLE RESOURCES");
    const ungroupedCount = await TelegramResource.countDocuments({
      $and: [
        { $or: [{ fileName: "" }, { fileName: null }] },
        { $or: [{ caption: "" }, { caption: null }] },
      ],
    });

    console.log(`  Empty fileName AND caption: ${ungroupedCount}`);
    if (ungroupedCount > 0) {
      const ungroupedSample = await TelegramResource.find(
        {
          $and: [
            { $or: [{ fileName: "" }, { fileName: null }] },
            { $or: [{ caption: "" }, { caption: null }] },
          ],
        },
        "channelUsername messageId fileType",
      ).limit(5);

      console.log(`  Sample ungrouped items (first 5):`);
      for (const item of ungroupedSample) {
        console.log(
          `    - @${item.channelUsername}/${item.messageId} (${item.fileType})`,
        );
      }
    }

    console.log("\n✅ Analysis complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error analyzing collection:", error);
    process.exit(1);
  }
}

analyzeCollection();
