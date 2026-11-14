require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function auditFormats() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { family: 4 });
  const db = mongoose.connection.db;
  const coll = db.collection('telegramresources');

  console.log('=== AUDITING FILE FORMATS & MEDIA GROUPS ===\n');

  // 1. fileType distribution for all and for available
  const fileTypeAll = await coll.aggregate([
    { $group: { _id: "$fileType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const fileTypeAvailable = await coll.aggregate([
    { $match: { isAvailable: true } },
    { $group: { _id: "$fileType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('fileType distribution (All):', fileTypeAll);
  console.log('fileType distribution (Available):', fileTypeAvailable);

  // 2. File extension distribution from fileName
  const extDistribution = await coll.aggregate([
    { $match: { isAvailable: true, fileName: { $exists: true, $nin: [null, ""] } } },
    {
      $project: {
        ext: {
          $toLower: {
            $arrayElemAt: [{ $split: ["$fileName", "."] }, -1]
          }
        },
        fileType: 1
      }
    },
    { $group: { _id: "$ext", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('\nTop 20 File Extensions (Available):');
  extDistribution.slice(0, 20).forEach(e => console.log(`  .${(e._id || '').padEnd(10)}: ${e.count}`));

  // 3. Mismatch between fileType and extension
  const mismatches = await coll.aggregate([
    { $match: { isAvailable: true, fileName: { $exists: true, $nin: [null, ""] } } },
    {
      $project: {
        fileName: 1,
        fileType: 1,
        ext: {
          $toLower: {
            $arrayElemAt: [{ $split: ["$fileName", "."] }, -1]
          }
        }
      }
    },
    {
      $match: {
        $or: [
          { fileType: 'pdf', ext: { $ne: 'pdf' } },
          { fileType: 'ppt', ext: { $nin: ['ppt', 'pptx'] } },
          { fileType: 'doc', ext: { $nin: ['doc', 'docx'] } },
          { fileType: 'image', ext: { $nin: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] } }
        ]
      }
    },
    { $group: { _id: { fileType: "$fileType", ext: "$ext" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('\nFileType vs Extension Mismatches:', mismatches);

  // 4. File sizes (zero-byte files or huge files)
  const zeroBytes = await coll.countDocuments({ isAvailable: true, fileSize: { $lte: 0 } });
  const smallFiles = await coll.countDocuments({ isAvailable: true, fileSize: { $gt: 0, $lt: 1024 } }); // <1KB
  const largeFiles = await coll.countDocuments({ isAvailable: true, fileSize: { $gt: 50 * 1024 * 1024 } }); // >50MB

  console.log(`\nFileSize anomalies (Available):`);
  console.log(`  fileSize <= 0:   ${zeroBytes}`);
  console.log(`  fileSize < 1KB:  ${smallFiles}`);
  console.log(`  fileSize > 50MB: ${largeFiles}`);

  // 5. Group / Album statistics
  const groupStats = await coll.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    {
      $group: {
        _id: "$groupId",
        size: { $sum: 1 },
        fileTypes: { $addToSet: "$fileType" },
        isExam: { $addToSet: "$isExam" },
        channel: { $first: "$channelUsername" }
      }
    },
    {
      $group: {
        _id: "$size",
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  console.log('\nGroup Size Distribution (number of albums having X files):');
  groupStats.slice(0, 15).forEach(g => console.log(`  Size ${String(g._id).padStart(2)}: ${g.count} groups`));

  // 6. Group types (pure image groups vs document groups vs mixed)
  const groupTypeMix = await coll.aggregate([
    { $match: { isAvailable: true, groupId: { $ne: null } } },
    {
      $group: {
        _id: "$groupId",
        types: { $addToSet: "$fileType" }
      }
    },
    {
      $project: {
        mix: {
          $cond: [
            { $eq: ["$types", ["image"]] },
            "pure_image_album",
            {
              $cond: [
                { $eq: ["$types", ["pdf"]] },
                "pure_pdf_bundle",
                {
                  $cond: [
                    { $eq: ["$types", ["ppt"]] },
                    "pure_ppt_bundle",
                    "mixed_types_bundle"
                  ]
                }
              ]
            }
          ]
        }
      }
    },
    { $group: { _id: "$mix", count: { $sum: 1 } } }
  ]).toArray();

  console.log('\nGroup Type Composition:', groupTypeMix);

  fs.writeFileSync('docs/data-audit/03-file-formats.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    fileTypeAll,
    fileTypeAvailable,
    extDistribution,
    mismatches,
    sizes: { zeroBytes, smallFiles, largeFiles },
    groupStats,
    groupTypeMix
  }, null, 2));

  console.log('\nWrote docs/data-audit/03-file-formats.json');

  await mongoose.disconnect();
}

auditFormats().catch(console.error);
