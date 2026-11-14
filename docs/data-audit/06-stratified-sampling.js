const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function runStratifiedSampling() {
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
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!connected) process.exit(1);

  const db = mongoose.connection.db;
  const coll = db.collection('telegramresources');

  console.log('=== STRATIFIED RESOURCE SAMPLING (Target: ~600-800 records) ===\n');

  // Sampling strata:
  // 1. PDF with strong academic keywords in filename & caption (100)
  // 2. Photo-based exam albums (fileType: image, groupId!=null) (100)
  // 3. Single images without groupId (50)
  // 4. PPT / PPTX presentations (75)
  // 5. DOC / DOCX documents (75)
  // 6. Ethiopic script (Amharic literature & university notes) (100)
  // 7. Generic filenames (e.g. Chapter, Unit, Lecture, CamScanner) (75)
  // 8. Documents with missing captions (75)
  // 9. Documents with explicit university tagged (ASTU, AAU, JU, etc.) (75)
  // 10. High-download resources (50)

  const strata = [
    {
      name: "PDF Academic Strong",
      query: { isAvailable: true, fileType: "pdf", isExam: true, caption: { $ne: "" } },
      limit: 75
    },
    {
      name: "Photo Exam Albums",
      query: { isAvailable: true, fileType: "image", groupId: { $ne: null } },
      limit: 75
    },
    {
      name: "Single Images (Quarantined/Unavailable)",
      query: { isAvailable: false, fileType: "image" },
      limit: 50
    },
    {
      name: "PPT / Slides",
      query: { isAvailable: true, fileType: "ppt" },
      limit: 75
    },
    {
      name: "DOC / Word Files",
      query: { isAvailable: true, fileType: "doc" },
      limit: 75
    },
    {
      name: "Amharic & Ethiopic Script Text",
      query: { isAvailable: true, caption: { $regex: /[ሀ-፼]/ } },
      limit: 75
    },
    {
      name: "Generic/Scanner Filenames",
      query: {
        isAvailable: true,
        fileName: { $regex: /^(chapter|unit|lecture|camscanner|image_to_pdf|doc|scan)/i }
      },
      limit: 60
    },
    {
      name: "Missing Captions",
      query: { isAvailable: true, fileType: "pdf", $or: [{ caption: "" }, { caption: null }] },
      limit: 60
    },
    {
      name: "University Tagged",
      query: { isAvailable: true, university: { $in: ["ASTU", "AAU", "JU", "Jimma", "Hawassa"] } },
      limit: 60
    },
    {
      name: "High Downloads",
      query: { isAvailable: true, downloadCount: { $gt: 0 } },
      limit: 50
    }
  ];

  const allSamples = [];
  const categorizedPatterns = {
    clearlyClassifiable: [],
    ambiguousTitles: [],
    requiresChannelContext: [],
    requiresExtractedText: [],
    requiresManualReview: [],
    unrelatedOrQuestionable: []
  };

  const sanitizeText = (str) => {
    if (!str) return "";
    return str
      .replace(/\+?251\d{9}/g, "+2519********") // mask phone numbers
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "***@***.com")
      .replace(/@([A-Za-z0-9_]{3,})/g, (m, u) => {
        // preserve known public channel names, mask private usernames
        const known = ["aplusethiopian", "astu_student", "freshmanebook", "amharic_fiction_books", "ethio_pdf_books", "qubeeacademy"];
        if (known.includes(u.toLowerCase())) return `@${u}`;
        return `@user_***`;
      });
  };

  for (const stratum of strata) {
    const docs = await coll.find(stratum.query)
      .project({
        fileName: 1,
        cleanTitle: 1,
        caption: 1,
        fileType: 1,
        fileSize: 1,
        channelUsername: 1,
        tags: 1,
        isExam: 1,
        courseCode: 1,
        year: 1,
        university: 1,
        semester: 1,
        downloadCount: 1,
        groupId: 1,
        groupIndex: 1,
        groupTotal: 1,
        isAvailable: 1
      })
      .limit(stratum.limit)
      .toArray();

    console.log(`Stratum: ${stratum.name.padEnd(35)} Sampled: ${docs.length}`);

    for (const d of docs) {
      const sanitized = {
        _id: d._id.toString(),
        stratum: stratum.name,
        fileName: d.fileName || "",
        cleanTitle: d.cleanTitle || "",
        captionSnippet: sanitizeText((d.caption || "").substring(0, 150).replace(/\n/g, " ")),
        fileType: d.fileType,
        fileSizeMB: d.fileSize ? (d.fileSize / (1024 * 1024)).toFixed(2) : "0",
        channelUsername: d.channelUsername,
        tags: d.tags || [],
        isExam: !!d.isExam,
        courseCode: d.courseCode || "",
        year: d.year || null,
        university: d.university || "",
        semester: d.semester || "",
        groupId: d.groupId ? d.groupId.toString() : null,
        groupTotal: d.groupTotal || 1,
        isAvailable: d.isAvailable !== false
      };

      allSamples.push(sanitized);

      // Heuristic categorization of classification challenges
      const fn = (sanitized.fileName || "").toLowerCase();
      const cap = (sanitized.captionSnippet || "").toLowerCase();
      const code = sanitized.courseCode;
      const tags = sanitized.tags;

      if (!sanitized.isAvailable) {
        categorizedPatterns.unrelatedOrQuestionable.push(sanitized);
      } else if (code || (tags.length >= 2 && (fn.includes("exam") || fn.includes("calculus") || fn.includes("physics") || fn.includes("chemistry") || fn.includes("biology") || fn.includes("dbms")))) {
        categorizedPatterns.clearlyClassifiable.push(sanitized);
      } else if (/^(chapter|unit|lecture|part|ch)\s*\d+/i.test(fn)) {
        if (cap.length > 20) {
          categorizedPatterns.ambiguousTitles.push(sanitized);
        } else {
          categorizedPatterns.requiresChannelContext.push(sanitized);
        }
      } else if (sanitized.fileType === "image") {
        if (sanitized.groupId && cap.length > 10) {
          categorizedPatterns.ambiguousTitles.push(sanitized);
        } else {
          categorizedPatterns.requiresExtractedText.push(sanitized);
        }
      } else if (!fn && !cap) {
        categorizedPatterns.requiresManualReview.push(sanitized);
      } else if (fn.length < 10 && cap.length < 20) {
        categorizedPatterns.requiresManualReview.push(sanitized);
      } else {
        categorizedPatterns.clearlyClassifiable.push(sanitized);
      }
    }
  }

  console.log(`\nTotal Stratified Samples Collected: ${allSamples.length}`);
  console.log(`Pattern Breakdown:`);
  console.log(`  1. Clearly Classifiable:        ${categorizedPatterns.clearlyClassifiable.length}`);
  console.log(`  2. Ambiguous Titles:             ${categorizedPatterns.ambiguousTitles.length}`);
  console.log(`  3. Requires Channel Context:     ${categorizedPatterns.requiresChannelContext.length}`);
  console.log(`  4. Requires Extracted Text/OCR:  ${categorizedPatterns.requiresExtractedText.length}`);
  console.log(`  5. Requires Manual Review:       ${categorizedPatterns.requiresManualReview.length}`);
  console.log(`  6. Unrelated / Questionable:     ${categorizedPatterns.unrelatedOrQuestionable.length}`);

  fs.writeFileSync('docs/data-audit/06-stratified-samples.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalSampled: allSamples.length,
    countsByPattern: {
      clearlyClassifiable: categorizedPatterns.clearlyClassifiable.length,
      ambiguousTitles: categorizedPatterns.ambiguousTitles.length,
      requiresChannelContext: categorizedPatterns.requiresChannelContext.length,
      requiresExtractedText: categorizedPatterns.requiresExtractedText.length,
      requiresManualReview: categorizedPatterns.requiresManualReview.length,
      unrelatedOrQuestionable: categorizedPatterns.unrelatedOrQuestionable.length
    },
    sampleExamples: {
      clearlyClassifiable: categorizedPatterns.clearlyClassifiable.slice(0, 8),
      ambiguousTitles: categorizedPatterns.ambiguousTitles.slice(0, 8),
      requiresChannelContext: categorizedPatterns.requiresChannelContext.slice(0, 8),
      requiresExtractedText: categorizedPatterns.requiresExtractedText.slice(0, 8),
      requiresManualReview: categorizedPatterns.requiresManualReview.slice(0, 8),
      unrelatedOrQuestionable: categorizedPatterns.unrelatedOrQuestionable.slice(0, 8)
    }
  }, null, 2));

  console.log('\nWrote docs/data-audit/06-stratified-samples.json');

  await mongoose.disconnect();
}

runStratifiedSampling().catch(console.error);
