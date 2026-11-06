/**
 * Read-Only Deep Diagnostic Audit for StudyHub Database and Archive Records.
 * DOES NOT ALTER ANY DATA. DOES NOT START ANY BOT OR TELEGRAM CLIENT.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');
const TelegramChannel = require('../src/db/models/TelegramChannel');

async function runAudit() {
  console.log('Connecting to MongoDB (Read-Only Audit)...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB.\n');

  // 1. Overall counts
  const totalResources = await TelegramResource.countDocuments();
  const totalChannels = await TelegramChannel.countDocuments();
  const activeChannels = await TelegramChannel.countDocuments({ active: true });
  console.log(`=== 1. GENERAL OVERVIEW ===`);
  console.log(`Total Resources in DB: ${totalResources.toLocaleString()}`);
  console.log(`Total Channels: ${totalChannels} (Active: ${activeChannels})`);

  // 2. File Type Distribution
  console.log(`\n=== 2. FILE TYPE BREAKDOWN ===`);
  const typeCounts = await TelegramResource.aggregate([
    { $group: { _id: '$fileType', count: { $sum: 1 }, avgSize: { $avg: '$fileSize' } } },
    { $sort: { count: -1 } }
  ]);
  typeCounts.forEach(t => {
    console.log(`  • ${t._id || 'unknown'}: ${t.count.toLocaleString()} files (avg size: ${Math.round(t.avgSize / 1024)} KB)`);
  });

  // 3. Deep Dive: IMAGE & ALBUM EXAMS (Crucial focus)
  console.log(`\n=== 3. IMAGES & PHOTO EXAM SETS (SPECIAL FOCUS) ===`);
  const totalImages = await TelegramResource.countDocuments({ fileType: 'image' });
  const groupedImages = await TelegramResource.countDocuments({ fileType: 'image', groupId: { $ne: null, $exists: true } });
  const singleImages = await TelegramResource.countDocuments({ fileType: 'image', $or: [{ groupId: null }, { groupId: { $exists: false } }] });
  
  // Count unique album groups
  const uniqueAlbums = await TelegramResource.distinct('groupId', { fileType: 'image', groupId: { $ne: null, $exists: true } });
  console.log(`Total Images: ${totalImages.toLocaleString()}`);
  console.log(`  ├─ Grouped Album Images: ${groupedImages.toLocaleString()} (across ${uniqueAlbums.length.toLocaleString()} distinct exam photo albums)`);
  console.log(`  └─ Single Isolated Images: ${singleImages.toLocaleString()}`);

  // How many albums are marked as exams?
  const examAlbums = await TelegramResource.distinct('groupId', {
    fileType: 'image',
    groupId: { $ne: null, $exists: true },
    isExam: true
  });
  console.log(`  ├─ Albums marked isExam=true: ${examAlbums.length.toLocaleString()} / ${uniqueAlbums.length.toLocaleString()} (${Math.round((examAlbums.length / uniqueAlbums.length) * 100)}%)`);

  // Sample grouped album images with captions
  console.log(`\n  --- Sample 5 Exam Albums (Grouped Images) ---`);
  const sampleAlbumIds = uniqueAlbums.slice(0, 5);
  for (const gId of sampleAlbumIds) {
    const albumItems = await TelegramResource.find({ groupId: gId }).sort({ groupIndex: 1 }).lean();
    const first = albumItems[0];
    console.log(`  [Album ${gId}] Count: ${albumItems.length} photos | Channel: @${first.channelUsername} | isExam: ${first.isExam}`);
    console.log(`     Tags: [${(first.tags || []).join(', ')}] | CourseCode: ${first.courseCode || 'none'} | Uni: ${first.university || 'none'}`);
    console.log(`     Caption: "${(first.caption || '').replace(/\r?\n/g, ' ').substring(0, 120)}..."`);
  }

  // Sample single images
  console.log(`\n  --- Sample 5 Single Images ---`);
  const sampleSingles = await TelegramResource.find({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }]
  }).limit(5).lean();
  sampleSingles.forEach((s, idx) => {
    console.log(`  [Single #${idx+1}] ID: ${s._id} | Channel: @${s.channelUsername} | isExam: ${s.isExam}`);
    console.log(`     Tags: [${(s.tags || []).join(', ')}] | Size: ${s.fileSize}`);
    console.log(`     Caption: "${(s.caption || '').replace(/\r?\n/g, ' ').substring(0, 120)}..."`);
  });

  // 4. Archive Status Breakdown
  console.log(`\n=== 4. ARCHIVE STATUS (Forwarded vs Pending) ===`);
  const archivedTotal = await TelegramResource.countDocuments({
    archiveMessageId: { $ne: null, $exists: true }
  });
  const unarchivedTotal = totalResources - archivedTotal;
  console.log(`Total Archived (forwarded to ARCHIVE_CHAT_ID): ${archivedTotal.toLocaleString()} (${Math.round((archivedTotal / totalResources) * 100)}%)`);
  console.log(`Total Pending/Unarchived: ${unarchivedTotal.toLocaleString()} (${Math.round((unarchivedTotal / totalResources) * 100)}%)`);

  // Archived by file type
  const archivedByType = await TelegramResource.aggregate([
    { $match: { archiveMessageId: { $ne: null, $exists: true } } },
    { $group: { _id: '$fileType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log(`  Archived Files Breakdown:`);
  archivedByType.forEach(t => {
    console.log(`    • ${t._id}: ${t.count.toLocaleString()} in archive channel`);
  });

  // 5. Document Quality & Tag Breakdown
  console.log(`\n=== 5. DOCUMENT QUALITY & ACADEMIC RELEVANCE ===`);
  const docCount = await TelegramResource.countDocuments({ fileType: { $in: ['pdf', 'ppt', 'doc'] } });
  const docWithTags = await TelegramResource.countDocuments({
    fileType: { $in: ['pdf', 'ppt', 'doc'] },
    'tags.0': { $exists: true }
  });
  const docNoTags = docCount - docWithTags;
  console.log(`Total Documents (PDF, PPT, DOC): ${docCount.toLocaleString()}`);
  console.log(`  ├─ Documents with at least 1 tag: ${docWithTags.toLocaleString()}`);
  console.log(`  └─ Documents with 0 tags: ${docNoTags.toLocaleString()} (${Math.round((docNoTags / docCount) * 100)}%)`);

  // 6. Pollution Patterns (Regex scan on DB)
  console.log(`\n=== 6. IDENTIFIED POLLUTION FACTORS ===`);
  const adRegex = /sponsored|promo|giveaway|airtime|discount|bonus|betting|forex|crypto|telegram channel|join our|subscribe|vip|contact admin|ዋጋ|ብር|ክፍያ|account|cbe|telebirr/i;
  const noticeRegex = /ምዝገባ|ቅበላ|ውጤት|ማስታወቂያ|ተመደባችሁ|ጥሪ|ቀን|መግቢያ|schedule|announcement|notice|registration|admitted|orientation|placement|deadline|vacancy|ክፍት የሥራ|ደመወዝ/i;
  
  const totalAds = await TelegramResource.countDocuments({ $or: [{ caption: adRegex }, { fileName: adRegex }] });
  const totalNotices = await TelegramResource.countDocuments({ $or: [{ caption: noticeRegex }, { fileName: noticeRegex }] });
  
  // How many ads/notices are images vs documents?
  const adsImages = await TelegramResource.countDocuments({ fileType: 'image', $or: [{ caption: adRegex }, { fileName: adRegex }] });
  const adsDocs = await TelegramResource.countDocuments({ fileType: { $in: ['pdf', 'ppt', 'doc'] }, $or: [{ caption: adRegex }, { fileName: adRegex }] });
  
  const noticesImages = await TelegramResource.countDocuments({ fileType: 'image', $or: [{ caption: noticeRegex }, { fileName: noticeRegex }] });
  const noticesDocs = await TelegramResource.countDocuments({ fileType: { $in: ['pdf', 'ppt', 'doc'] }, $or: [{ caption: noticeRegex }, { fileName: noticeRegex }] });

  console.log(`Commercial Ads Detected: ${totalAds.toLocaleString()}`);
  console.log(`  ├─ In Images: ${adsImages.toLocaleString()}`);
  console.log(`  └─ In Documents: ${adsDocs.toLocaleString()}`);
  console.log(`Administrative Notices Detected: ${totalNotices.toLocaleString()}`);
  console.log(`  ├─ In Images: ${noticesImages.toLocaleString()}`);
  console.log(`  └─ In Documents: ${noticesDocs.toLocaleString()}`);

  // How many ads/notices are actually IN the archive channel right now?
  const archivedAds = await TelegramResource.countDocuments({
    archiveMessageId: { $ne: null, $exists: true },
    $or: [{ caption: adRegex }, { fileName: adRegex }]
  });
  const archivedNotices = await TelegramResource.countDocuments({
    archiveMessageId: { $ne: null, $exists: true },
    $or: [{ caption: noticeRegex }, { fileName: noticeRegex }]
  });
  console.log(`Pollution currently sitting in Telegram Archive Channel:`);
  console.log(`  ├─ Forwarded Ads in Archive: ${archivedAds.toLocaleString()}`);
  console.log(`  └─ Forwarded Notices in Archive: ${archivedNotices.toLocaleString()}`);

  // 7. Channel Distribution (Top channels)
  console.log(`\n=== 7. TOP 10 CHANNELS BY RESOURCE VOLUME ===`);
  const topChannels = await TelegramResource.aggregate([
    { $group: { _id: '$channelUsername', count: { $sum: 1 }, images: { $sum: { $cond: [{ $eq: ['$fileType', 'image'] }, 1, 0] } }, docs: { $sum: { $cond: [{ $in: ['$fileType', ['pdf', 'ppt', 'doc']] }, 1, 0] } } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  topChannels.forEach((c, idx) => {
    console.log(`  ${idx+1}. @${c._id || 'unknown'}: ${c.count.toLocaleString()} total (📸 ${c.images.toLocaleString()} images, 📄 ${c.docs.toLocaleString()} docs)`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Read-only audit complete. Disconnected from DB.');
}

runAudit().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
