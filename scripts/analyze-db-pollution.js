require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function analyzeJunk() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // 1. Channel username causing false positive tag
  // Check how many have tags == ['exam'] purely from channel username
  console.log('--- Analyzing Pollution Factors ---');
  
  // 2. Announcements / news keywords
  const announcementRegex = /ምዝገባ|ቅበላ|ውጤት|ማስታወቂያ|ተመደባችሁ|ጥሪ|ቀን|መግቢያ|schedule|announcement|notice|registration|admitted|orientation|placement|deadline|vacancy|ክፍት የሥራ|ደመወዝ/i;
  const countAnnouncements = await TelegramResource.countDocuments({
    $or: [{ caption: announcementRegex }, { fileName: announcementRegex }]
  });
  console.log('Resources matching announcement keywords (Amharic & English):', countAnnouncements);

  // 3. Promotional / Ad keywords
  const adRegex = /sponsored|promo|giveaway|airtime|discount|bonus|betting|forex|crypto|telegram channel|join our|subscribe|vip|contact admin|ዋጋ|ብር|ክፍያ|account|cbe|telebirr/i;
  const countAds = await TelegramResource.countDocuments({
    $or: [{ caption: adRegex }, { fileName: adRegex }]
  });
  console.log('Resources matching Ad/promo keywords:', countAds);

  // 4. Random images (image files that are not exam sets / past papers)
  const singleImages = await TelegramResource.countDocuments({
    fileType: 'image',
    $or: [{ groupId: null }, { groupId: { $exists: false } }]
  });
  console.log('Isolated single images (often flyers/photos):', singleImages);

  // 5. Zero-byte files or tiny thumbnails
  const tinyFiles = await TelegramResource.countDocuments({
    fileSize: { $lt: 5000 } // < 5 KB
  });
  console.log('Tiny files (< 5KB):', tinyFiles);

  // 6. Non-academic file extensions or generic names
  const genericNames = await TelegramResource.countDocuments({
    fileName: { $regex: /^(document|photo|image|scan|scan_\d+|untitled|new doc|file)\.(pdf|docx?|jpg|png)$/i }
  });
  console.log('Generic filenames (e.g. document.pdf, scan_001.pdf):', genericNames);

  // 7. Academic signals check:
  // How many actually have course tags, syllabus keywords, or exam identifiers?
  const strongAcademic = await TelegramResource.countDocuments({
    $or: [
      { courseCode: { $exists: true, $ne: '' } },
      { tags: { $in: ['calculus', 'physics', 'database', 'dbms', 'oop', 'data_structure', 'chemistry', 'programming', 'software_engineering', 'algorithms', 'operating_system', 'linear_algebra', 'circuit'] } },
      { fileName: { $regex: /final|midterm|mid|exam|quiz|lecture|handout|chapter|module|slide|tutorial|lab|assignment|solution|textbook/i } }
    ]
  });
  console.log('Resources with STRONG academic signals:', strongAcademic);

  await mongoose.disconnect();
}

analyzeJunk().catch(console.error);
