/**
 * Deep DB Analysis Script — Phase 0
 * Analyzes the entire TelegramResource collection for quality issues.
 * DOES NOT modify any data.
 */
require('dotenv').config();
const mongoose = require('mongoose');
require('../src/db/models/TelegramResource');

const Resource = mongoose.model('TelegramResource');

// Amharic/Ge'ez Unicode range: \u1200-\u137F (Ethiopic block)
// Oromo uses Latin script but with specific patterns
const ETHIOPIC_RE = /[\u1200-\u137F]/;
const LATIN_RE = /[a-zA-Z]/;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const results = {};

  // =====================================================
  // 1. SINGLE-IMAGE RESOURCES (no groupId)
  // =====================================================
  console.log('━━━ 1. SINGLE-IMAGE RESOURCES ━━━');
  const singleImageCount = await Resource.countDocuments({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
    isAvailable: { $ne: false }
  });
  console.log(`Total single images (available): ${singleImageCount}`);

  // Sample 30 single images
  const singleImageSamples = await Resource.find({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
    isAvailable: { $ne: false }
  })
    .select('fileName caption fileSize tags channelUsername downloadCount isExam messageDate')
    .sort({ downloadCount: -1 })
    .limit(30)
    .lean();

  console.log(`\nTop 30 by downloads:`);
  singleImageSamples.forEach((s, i) => {
    const cap = (s.caption || '').substring(0, 80).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. dl=${s.downloadCount || 0} | exam=${s.isExam || false} | cap="${cap}" | file="${s.fileName || 'N/A'}" | ch=${s.channelUsername}`);
  });

  // Single images WITH captions
  const singleImageWithCaption = await Resource.countDocuments({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
    isAvailable: { $ne: false },
    caption: { $ne: null, $ne: '' }
  });

  // Single images that are marked as exam
  const singleImageExam = await Resource.countDocuments({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
    isAvailable: { $ne: false },
    isExam: true
  });

  console.log(`\nSingle images with caption: ${singleImageWithCaption}`);
  console.log(`Single images marked isExam: ${singleImageExam}`);
  results.singleImages = { total: singleImageCount, withCaption: singleImageWithCaption, markedExam: singleImageExam };

  // =====================================================
  // 2. AMHARIC/OROMO-ONLY CAPTIONS (no English academic signal)
  // =====================================================
  console.log('\n━━━ 2. AMHARIC/OROMO-ONLY CAPTION ANALYSIS ━━━');

  // Fetch all resources with captions in pages
  let amharicOnly = 0;
  let amharicOnlySamples = [];
  let amharicOnlyByType = { pdf: 0, ppt: 0, doc: 0, image: 0, other: 0 };
  let lastId = null;
  const PAGE_SIZE = 2000;
  let totalScanned = 0;

  // Academic keywords that indicate real resources even in Amharic posts
  const ACADEMIC_KW = /\b(exam|quiz|test|midterm|final|assignment|chapter|lecture|note|slide|lab|tutorial|course|module|unit|semester|worksheet|handout|solution|review|study|guide|summary|formula|calculus|physics|chemistry|biology|math|engineering|accounting|management|economics|programming|database|algorithm|network|operating\s*system|data\s*structure|oop|civil|electrical|mechanical|software|computer|information)\b/i;
  const COURSE_CODE = /\b[A-Z]{2,5}\s*[-]?\s*\d{3,4}\b/i;
  const FILE_EXT = /\.(pdf|pptx?|docx?|xlsx?)\b/i;

  console.log('Scanning captions...');
  while (true) {
    const query = {
      isAvailable: { $ne: false },
      caption: { $exists: true, $ne: null, $ne: '' }
    };
    if (lastId) query._id = { $gt: lastId };

    const page = await Resource.find(query)
      .select('_id caption fileType fileName channelUsername downloadCount')
      .sort({ _id: 1 })
      .limit(PAGE_SIZE)
      .lean();

    if (page.length === 0) break;
    totalScanned += page.length;

    for (const doc of page) {
      const cap = doc.caption || '';
      if (!cap) continue;

      const hasEthiopic = ETHIOPIC_RE.test(cap);
      if (!hasEthiopic) continue;

      // Check if there are any English academic signals
      const hasAcademic = ACADEMIC_KW.test(cap);
      const hasCourseCode = COURSE_CODE.test(cap);
      const hasFileExt = FILE_EXT.test(cap);
      const hasEnglish = (cap.match(/[a-zA-Z]/g) || []).length > 10; // More than 10 Latin chars

      if (!hasAcademic && !hasCourseCode && !hasFileExt && !hasEnglish) {
        amharicOnly++;
        amharicOnlyByType[doc.fileType] = (amharicOnlyByType[doc.fileType] || 0) + 1;
        if (amharicOnlySamples.length < 25) {
          amharicOnlySamples.push({
            type: doc.fileType,
            caption: cap.substring(0, 120),
            fileName: doc.fileName,
            channel: doc.channelUsername,
            downloads: doc.downloadCount || 0
          });
        }
      }
    }
    lastId = page[page.length - 1]._id;
    process.stdout.write(`\r  Scanned ${totalScanned} captions...`);
  }

  console.log(`\n\nAmharic/Oromo-only (no English academic signals): ${amharicOnly}`);
  console.log('By type:', amharicOnlyByType);
  console.log('\nSamples:');
  amharicOnlySamples.forEach((s, i) => {
    const cap = s.caption.replace(/\n/g, ' ');
    console.log(`  ${i + 1}. [${s.type}] dl=${s.downloads} ch=${s.channel} cap="${cap}"`);
  });
  results.amharicOnly = { total: amharicOnly, byType: amharicOnlyByType };

  // =====================================================
  // 3. FILENAME QUALITY ANALYSIS
  // =====================================================
  console.log('\n━━━ 3. FILENAME QUALITY ANALYSIS ━━━');

  // Long filenames (>80 chars)
  const longFileNames = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $expr: { $gt: [{ $strLenCP: { $ifNull: ['$fileName', ''] } }, 80] }
  });

  // Files with no fileName
  const noFileName = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $or: [{ fileName: null }, { fileName: { $exists: false } }, { fileName: '' }]
  });

  // Sample long filenames
  const longNameSamples = await Resource.find({
    isAvailable: { $ne: false },
    $expr: { $gt: [{ $strLenCP: { $ifNull: ['$fileName', ''] } }, 80] }
  })
    .select('fileName fileType caption channelUsername')
    .limit(15)
    .lean();

  console.log(`Files with name > 80 chars: ${longFileNames}`);
  console.log(`Files with no fileName: ${noFileName}`);
  console.log('\nLong filename samples:');
  longNameSamples.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.fileType}] "${s.fileName}"`);
  });

  // Files with garbled/encoded names
  const garbledSamples = await Resource.find({
    isAvailable: { $ne: false },
    fileName: { $regex: /(%[0-9A-F]{2}|[\x00-\x1F]|_{3,}|-{3,})/, $options: 'i' }
  })
    .select('fileName fileType')
    .limit(10)
    .lean();

  console.log(`\nGarbled/encoded filename samples (${garbledSamples.length}):`);
  garbledSamples.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.fileType}] "${s.fileName}"`);
  });

  results.fileNames = { longNames: longFileNames, noFileName: noFileName };

  // =====================================================
  // 4. DOWNLOAD COUNT DISTRIBUTION
  // =====================================================
  console.log('\n━━━ 4. DOWNLOAD COUNT DISTRIBUTION ━━━');

  const dlStats = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalDownloads: { $sum: { $ifNull: ['$downloadCount', 0] } },
        maxDl: { $max: { $ifNull: ['$downloadCount', 0] } },
        avgDl: { $avg: { $ifNull: ['$downloadCount', 0] } },
        zeroDownloads: { $sum: { $cond: [{ $lte: [{ $ifNull: ['$downloadCount', 0] }, 0] }, 1, 0] } },
        dl1to5: { $sum: { $cond: [{ $and: [{ $gte: [{ $ifNull: ['$downloadCount', 0] }, 1] }, { $lte: [{ $ifNull: ['$downloadCount', 0] }, 5] }] }, 1, 0] } },
        dl6to20: { $sum: { $cond: [{ $and: [{ $gte: [{ $ifNull: ['$downloadCount', 0] }, 6] }, { $lte: [{ $ifNull: ['$downloadCount', 0] }, 20] }] }, 1, 0] } },
        dl21to50: { $sum: { $cond: [{ $and: [{ $gte: [{ $ifNull: ['$downloadCount', 0] }, 21] }, { $lte: [{ $ifNull: ['$downloadCount', 0] }, 50] }] }, 1, 0] } },
        dl51to100: { $sum: { $cond: [{ $and: [{ $gte: [{ $ifNull: ['$downloadCount', 0] }, 51] }, { $lte: [{ $ifNull: ['$downloadCount', 0] }, 100] }] }, 1, 0] } },
        dl100plus: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$downloadCount', 0] }, 100] }, 1, 0] } }
      }
    }
  ]);

  if (dlStats.length > 0) {
    const s = dlStats[0];
    console.log(`Total resources: ${s.total}`);
    console.log(`Total downloads across all: ${s.totalDownloads}`);
    console.log(`Max downloads: ${s.maxDl}`);
    console.log(`Avg downloads: ${s.avgDl.toFixed(2)}`);
    console.log(`\nDistribution:`);
    console.log(`  0 downloads: ${s.zeroDownloads} (${(s.zeroDownloads / s.total * 100).toFixed(1)}%)`);
    console.log(`  1-5 downloads: ${s.dl1to5} (${(s.dl1to5 / s.total * 100).toFixed(1)}%)`);
    console.log(`  6-20 downloads: ${s.dl6to20} (${(s.dl6to20 / s.total * 100).toFixed(1)}%)`);
    console.log(`  21-50 downloads: ${s.dl21to50} (${(s.dl21to50 / s.total * 100).toFixed(1)}%)`);
    console.log(`  51-100 downloads: ${s.dl51to100} (${(s.dl51to100 / s.total * 100).toFixed(1)}%)`);
    console.log(`  100+ downloads: ${s.dl100plus} (${(s.dl100plus / s.total * 100).toFixed(1)}%)`);
    results.downloads = s;
  }

  // Top 20 most downloaded
  const topDownloaded = await Resource.find({ isAvailable: { $ne: false } })
    .select('fileName caption fileType downloadCount channelUsername groupId isExam tags')
    .sort({ downloadCount: -1 })
    .limit(20)
    .lean();

  console.log('\nTop 20 most downloaded:');
  topDownloaded.forEach((s, i) => {
    const cap = (s.caption || '').substring(0, 60).replace(/\n/g, ' ');
    const name = (s.fileName || 'N/A').substring(0, 50);
    console.log(`  ${i + 1}. dl=${s.downloadCount} [${s.fileType}] grp=${s.groupId ? 'Y' : 'N'} exam=${s.isExam || false} file="${name}" cap="${cap}"`);
  });

  // =====================================================
  // 5. CAPTION LENGTH DISTRIBUTION
  // =====================================================
  console.log('\n━━━ 5. CAPTION LENGTH DISTRIBUTION ━━━');

  const capStats = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false }, caption: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgLen: { $avg: { $strLenCP: '$caption' } },
        maxLen: { $max: { $strLenCP: '$caption' } },
        over200: { $sum: { $cond: [{ $gt: [{ $strLenCP: '$caption' }, 200] }, 1, 0] } },
        over500: { $sum: { $cond: [{ $gt: [{ $strLenCP: '$caption' }, 500] }, 1, 0] } },
        over1000: { $sum: { $cond: [{ $gt: [{ $strLenCP: '$caption' }, 1000] }, 1, 0] } }
      }
    }
  ]);

  if (capStats.length > 0) {
    const c = capStats[0];
    console.log(`Resources with caption: ${c.total}`);
    console.log(`Avg caption length: ${c.avgLen.toFixed(1)} chars`);
    console.log(`Max caption length: ${c.maxLen} chars`);
    console.log(`Captions > 200 chars: ${c.over200}`);
    console.log(`Captions > 500 chars: ${c.over500}`);
    console.log(`Captions > 1000 chars: ${c.over1000}`);
    results.captions = c;
  }

  // Sample the longest captions
  const longestCaptions = await Resource.find({
    isAvailable: { $ne: false },
    caption: { $exists: true, $ne: null }
  })
    .select('caption fileType fileName channelUsername')
    .sort({ caption: -1 }) // This won't sort by length but by string comparison
    .limit(5)
    .lean();

  // =====================================================
  // 6. OVERALL BREAKDOWN
  // =====================================================
  console.log('\n━━━ 6. OVERALL QUALITY BREAKDOWN ━━━');

  const byType = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false } } },
    {
      $group: {
        _id: '$fileType',
        count: { $sum: 1 },
        withGroup: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$groupId', null] }, null] }, 1, 0] } },
        withCaption: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ['$caption', ''] }, ''] }] }, 1, 0] } },
        exams: { $sum: { $cond: [{ $eq: ['$isExam', true] }, 1, 0] } },
        totalDl: { $sum: { $ifNull: ['$downloadCount', 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]);

  console.log('By file type:');
  byType.forEach(t => {
    console.log(`  ${t._id}: ${t.count} total, ${t.withGroup} grouped, ${t.withCaption} captioned, ${t.exams} exams, ${t.totalDl} total downloads`);
  });

  // Channel distribution
  const byChannel = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false } } },
    {
      $group: {
        _id: '$channelUsername',
        count: { $sum: 1 },
        totalDl: { $sum: { $ifNull: ['$downloadCount', 0] } }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  console.log('\nTop 20 source channels:');
  byChannel.forEach((ch, i) => {
    console.log(`  ${i + 1}. @${ch._id}: ${ch.count} resources, ${ch.totalDl} downloads`);
  });

  // =====================================================
  // 7. RESOURCES WITH NO USEFUL METADATA
  // =====================================================
  console.log('\n━━━ 7. ORPHAN/LOW-QUALITY RESOURCES ━━━');

  // No caption AND no fileName
  const noMetadata = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $or: [{ caption: null }, { caption: '' }, { caption: { $exists: false } }],
    $or: [{ fileName: null }, { fileName: '' }, { fileName: { $exists: false } }]
  });

  // Actually this $or overlap is a bug. Let me use $and:
  const noMetadata2 = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $and: [
      { $or: [{ caption: null }, { caption: '' }, { caption: { $exists: false } }] },
      { $or: [{ fileName: null }, { fileName: '' }, { fileName: { $exists: false } }] }
    ]
  });

  console.log(`Resources with no caption AND no fileName: ${noMetadata2}`);

  // No tags
  const noTags = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $or: [{ tags: { $size: 0 } }, { tags: null }, { tags: { $exists: false } }]
  });
  console.log(`Resources with no tags: ${noTags}`);

  // Zero relevanceScore
  const noScore = await Resource.countDocuments({
    isAvailable: { $ne: false },
    $or: [{ relevanceScore: 0 }, { relevanceScore: null }, { relevanceScore: { $exists: false } }]
  });
  console.log(`Resources with zero/null relevanceScore: ${noScore}`);

  // =====================================================
  // 8. DUPLICATE fileUniqueId CHECK
  // =====================================================
  console.log('\n━━━ 8. DUPLICATE CHECK ━━━');

  const dupes = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false }, fileUniqueId: { $exists: true, $ne: null } } },
    { $group: { _id: '$fileUniqueId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const totalDupeGroups = await Resource.aggregate([
    { $match: { isAvailable: { $ne: false }, fileUniqueId: { $exists: true, $ne: null } } },
    { $group: { _id: '$fileUniqueId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' }
  ]);

  console.log(`Duplicate fileUniqueId groups: ${totalDupeGroups[0]?.total || 0}`);
  if (dupes.length > 0) {
    console.log('Top duplicates:');
    dupes.forEach((d, i) => {
      console.log(`  ${i + 1}. fileUniqueId=${d._id} appears ${d.count} times`);
    });
  }

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY OF FINDINGS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Single images (no group): ${singleImageCount}`);
  console.log(`  - Marked as exam: ${singleImageExam}`);
  console.log(`Amharic/Oromo-only captions: ${amharicOnly}`);
  console.log(`Long filenames (>80 chars): ${longFileNames}`);
  console.log(`No fileName: ${noFileName}`);
  console.log(`No caption + no fileName: ${noMetadata2}`);
  console.log(`No tags: ${noTags}`);
  console.log(`Zero relevance score: ${noScore}`);
  console.log(`Duplicate fileUniqueIds: ${totalDupeGroups[0]?.total || 0}`);

  await mongoose.disconnect();
  console.log('\n✅ Analysis complete');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
