require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { classifyResource, classifyAlbum } = require("../src/classification/classifier.service");

async function generateWorksheet() {
  const uri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
  await mongoose.connect(uri);

  const buckets = {
    highClassified: [],       // 6 items
    mediumClassified: [],     // 6 items
    mediumNeedsReview: [],    // 6 items
    lowNeedsReview: [],       // 6 items (ambiguous/conflicting)
    lowUnclassified: [],      // 6 items
    multiCollection: [],      // 2 items
  };

  const cursor = TelegramResource.find({
    isAvailable: true
  }).limit(2000).lean().cursor();

  for await (const doc of cursor) {
    const isAlbum = Boolean(doc.groupId);
    const pred = isAlbum ? classifyAlbum([doc]) : classifyResource(doc);

    const title = doc.cleanTitle || doc.fileName || "";
    if (!title || title.length < 5) continue;

    const item = {
      id: doc._id.toString(),
      title,
      fileName: doc.fileName || "n/a",
      channel: doc.channelUsername || "n/a",
      tags: doc.tags && doc.tags.length ? doc.tags.join(", ") : "none",
      isExam: doc.isExam,
      fileType: doc.fileType,
      university: doc.university || "none",
      courseCode: doc.courseCode || "none",
      prediction: pred
    };

    if (pred.collections.length > 1 && buckets.multiCollection.length < 3) {
      buckets.multiCollection.push(item);
    } else if (pred.confidence === "high" && pred.status === "classified" && buckets.highClassified.length < 6) {
      buckets.highClassified.push(item);
    } else if (pred.confidence === "medium" && pred.status === "classified" && buckets.mediumClassified.length < 6) {
      buckets.mediumClassified.push(item);
    } else if (pred.confidence === "medium" && pred.status === "needs_review" && buckets.mediumNeedsReview.length < 6) {
      buckets.mediumNeedsReview.push(item);
    } else if (pred.confidence === "low" && pred.status === "needs_review" && buckets.lowNeedsReview.length < 6) {
      buckets.lowNeedsReview.push(item);
    } else if (pred.confidence === "low" && pred.status === "unclassified" && buckets.lowUnclassified.length < 6) {
      buckets.lowUnclassified.push(item);
    }

    const totalCollected = Object.values(buckets).reduce((sum, b) => sum + b.length, 0);
    if (totalCollected >= 33) break;
  }

  // Combine to exactly ~30 items
  const selected = [
    ...buckets.highClassified,
    ...buckets.mediumClassified,
    ...buckets.mediumNeedsReview,
    ...buckets.lowNeedsReview,
    ...buckets.lowUnclassified,
    ...buckets.multiCollection,
  ].slice(0, 30);

  let md = `# StudyHub Phase 3.3.1 — Classification Quality Audit & Human Review Worksheet

**Generated Date:** ${new Date().toISOString().split("T")[0]}  
**Sample Size:** ${selected.length} representative entities  
**Evaluation Scope:** Baseline classifier predictions for manual human verification  

> [!IMPORTANT]
> The predictions listed below are **automated rule-based model outputs**, NOT confirmed or human-verified facts. Human reviewers must inspect the evidence, determine the correct labels, and record their decisions in the blank fields provided.

---

## Instructions for Reviewers

1. **Reviewer Decision**: Check \`[x] Agree\`, \`[ ] Disagree\`, or \`[ ] Uncertain\`.
2. **Human-Verified Collections**: Enter 0, 1, or more official collection IDs:
   - \`study-materials\`
   - \`ethiopian-fiction-reading\`
   - \`past-exams-entrance-exit\`
   - \`university-freshman-courses\`
3. **Human-Verified Categories**: Enter appropriate category ID from the 21 approved taxonomy categories (or \`none\` if truly general or unacademic).
4. **Notes / Rationale**: Briefly note why you agree or disagree, especially if conflicting or misleading metadata exists.

---

## Worksheet Table

`;

  selected.forEach((item, index) => {
    md += `### Item #${index + 1}: ${item.title}\n\n`;
    md += `- **Database ID**: \`${item.id}\`\n`;
    md += `- **File Details**: File: \`${item.fileName}\` | Type: \`${item.fileType}\` | Channel: \`@${item.channel}\`\n`;
    md += `- **Metadata**: Tags: \`${item.tags}\` | isExam: \`${item.isExam}\` | University: \`${item.university}\` | CourseCode: \`${item.courseCode}\`\n`;
    md += `- **Model Prediction**:\n`;
    md += `  - Collections: \`${JSON.stringify(item.prediction.collections)}\`\n`;
    md += `  - Categories: \`${JSON.stringify(item.prediction.categories)}\`\n`;
    md += `  - Confidence: **${item.prediction.confidence}** | Status: **${item.prediction.status}**\n`;
    md += `  - Reasons: ${item.prediction.reasons.join("; ")}\n\n`;
    md += `| Field | Human Reviewer Entry |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Reviewer Decision** | [ ] Agree &nbsp;&nbsp;&nbsp; [ ] Disagree &nbsp;&nbsp;&nbsp; [ ] Uncertain |\n`;
    md += `| **Human-Verified Collection(s)** | |\n`;
    md += `| **Human-Verified Category(ies)** | |\n`;
    md += `| **Reviewer Notes & Action** | |\n\n`;
    md += `---\n\n`;
  });

  const outPath = path.join(__dirname, "..", "reports", "classification-human-review-worksheet.md");
  fs.writeFileSync(outPath, md, "utf8");
  console.log(`Generated worksheet with ${selected.length} items at: ${outPath}`);

  await mongoose.disconnect();
}

generateWorksheet().catch(console.error);
