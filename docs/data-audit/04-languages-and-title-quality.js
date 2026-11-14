const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function auditLanguagesAndTitles() {
  const uri = process.env.MONGO_URI;
  
  let connected = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4
      });
      connected = true;
      break;
    } catch (err) {
      console.warn(`Connection attempt ${attempt} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    console.error('Could not connect to MongoDB after 3 attempts.');
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const coll = db.collection('telegramresources');

  console.log('=== AUDITING LANGUAGES & TITLE/CAPTION QUALITY ===\n');

  const ETHIOPIC_RE = /[\u1200-\u137F]/;
  const LATIN_RE = /[a-zA-Z]/;
  
  const SCANNER_ARTIFACT_RE = /^(image_to_pdf|scan|scanner|camscanner|document|img_\d|photo_\d|wp_\d|vid_\d|file_\d|untitled|new_doc)/i;
  const GENERIC_CHAPTER_RE = /^(chapter|unit|lecture|part|section|module|ch)\s*[-_]?\s*\d+(\s*(part|pt|section)\s*\d+)?$/i;
  const COURSE_CODE_RE = /\b[A-Za-z]{2,5}\s*[-]?\s*\d{2,4}\b/;
  const YEAR_RE = /\b(201\d|202\d|19\d\d)\b/;

  let totalScanned = 0;
  let ethOnlyCount = 0;
  let latinOnlyCount = 0;
  let mixedScriptCount = 0;
  let neitherScriptCount = 0;

  let emptyFileNameCount = 0;
  let emptyCaptionCount = 0;
  let emptyBothCount = 0;

  let scannerArtifactTitleCount = 0;
  let genericChapterTitleCount = 0;
  let titleWithCourseCodeCount = 0;
  let titleWithYearCount = 0;

  const cursor = coll.find(
    { isAvailable: true },
    { projection: { fileName: 1, cleanTitle: 1, caption: 1, fileType: 1, channelUsername: 1 } }
  );

  console.log('Scanning 83,070 available documents...');

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    totalScanned++;

    const fn = doc.fileName || '';
    const cap = doc.caption || '';
    const title = doc.cleanTitle || '';

    if (!fn) emptyFileNameCount++;
    if (!cap) emptyCaptionCount++;
    if (!fn && !cap) emptyBothCount++;

    const combined = `${fn} ${cap} ${title}`;
    const hasEth = ETHIOPIC_RE.test(combined);
    const hasLatin = LATIN_RE.test(combined);

    if (hasEth && hasLatin) mixedScriptCount++;
    else if (hasEth && !hasLatin) ethOnlyCount++;
    else if (!hasEth && hasLatin) latinOnlyCount++;
    else neitherScriptCount++;

    if (SCANNER_ARTIFACT_RE.test(title) || SCANNER_ARTIFACT_RE.test(fn)) {
      scannerArtifactTitleCount++;
    }
    if (GENERIC_CHAPTER_RE.test(title) || GENERIC_CHAPTER_RE.test(fn)) {
      genericChapterTitleCount++;
    }
    if (COURSE_CODE_RE.test(title) || COURSE_CODE_RE.test(fn)) {
      titleWithCourseCodeCount++;
    }
    if (YEAR_RE.test(title) || YEAR_RE.test(fn)) {
      titleWithYearCount++;
    }

    if (totalScanned % 20000 === 0) {
      console.log(`  Processed ${totalScanned} documents...`);
    }
  }

  console.log(`\nScan Complete: ${totalScanned} available documents analyzed.\n`);

  const langStats = {
    totalScanned,
    latinOnly: { count: latinOnlyCount, pct: ((latinOnlyCount / totalScanned) * 100).toFixed(2) },
    mixedLatinEthiopic: { count: mixedScriptCount, pct: ((mixedScriptCount / totalScanned) * 100).toFixed(2) },
    ethiopicOnly: { count: ethOnlyCount, pct: ((ethOnlyCount / totalScanned) * 100).toFixed(2) },
    neither: { count: neitherScriptCount, pct: ((neitherScriptCount / totalScanned) * 100).toFixed(2) }
  };

  const textPresenceStats = {
    emptyFileName: { count: emptyFileNameCount, pct: ((emptyFileNameCount / totalScanned) * 100).toFixed(2) },
    emptyCaption: { count: emptyCaptionCount, pct: ((emptyCaptionCount / totalScanned) * 100).toFixed(2) },
    emptyBoth: { count: emptyBothCount, pct: ((emptyBothCount / totalScanned) * 100).toFixed(2) }
  };

  const titleQualityStats = {
    scannerArtifact: { count: scannerArtifactTitleCount, pct: ((scannerArtifactTitleCount / totalScanned) * 100).toFixed(2) },
    genericChapterWithoutContext: { count: genericChapterTitleCount, pct: ((genericChapterTitleCount / totalScanned) * 100).toFixed(2) },
    containsCourseCode: { count: titleWithCourseCodeCount, pct: ((titleWithCourseCodeCount / totalScanned) * 100).toFixed(2) },
    containsYear: { count: titleWithYearCount, pct: ((titleWithYearCount / totalScanned) * 100).toFixed(2) }
  };

  console.log('Language Breakdown (Script Presence):');
  console.log(`  English / Latin only:     ${langStats.latinOnly.count} (${langStats.latinOnly.pct}%)`);
  console.log(`  Mixed Latin + Ethiopic:   ${langStats.mixedLatinEthiopic.count} (${langStats.mixedLatinEthiopic.pct}%)`);
  console.log(`  Ethiopic script only:     ${langStats.ethiopicOnly.count} (${langStats.ethiopicOnly.pct}%)`);
  console.log(`  Neither (symbols/empty):  ${langStats.neither.count} (${langStats.neither.pct}%)`);

  console.log('\nText Presence:');
  console.log(`  Missing fileName:         ${textPresenceStats.emptyFileName.count} (${textPresenceStats.emptyFileName.pct}%)`);
  console.log(`  Missing caption:          ${textPresenceStats.emptyCaption.count} (${textPresenceStats.emptyCaption.pct}%)`);
  console.log(`  Missing BOTH:             ${textPresenceStats.emptyBoth.count} (${textPresenceStats.emptyBoth.pct}%)`);

  console.log('\nTitle Quality Patterns:');
  console.log(`  Scanner/Camera Artifacts: ${titleQualityStats.scannerArtifact.count} (${titleQualityStats.scannerArtifact.pct}%)`);
  console.log(`  Generic Chapter/Unit:     ${titleQualityStats.genericChapterWithoutContext.count} (${titleQualityStats.genericChapterWithoutContext.pct}%)`);
  console.log(`  Contains Course Code:     ${titleQualityStats.containsCourseCode.count} (${titleQualityStats.containsCourseCode.pct}%)`);
  console.log(`  Contains Academic Year:   ${titleQualityStats.containsYear.count} (${titleQualityStats.containsYear.pct}%)`);

  fs.writeFileSync('docs/data-audit/04-languages-and-titles.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    langStats,
    textPresenceStats,
    titleQualityStats
  }, null, 2));

  console.log('\nWrote docs/data-audit/04-languages-and-titles.json');

  await mongoose.disconnect();
}

auditLanguagesAndTitles().catch(console.error);
