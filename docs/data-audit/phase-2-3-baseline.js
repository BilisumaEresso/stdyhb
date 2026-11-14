const mongoose = require("mongoose");
const searchService = require("../../src/search/search.service");

async function checkBaseline() {
  const LOCAL_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
  await mongoose.connect(LOCAL_URI, { family: 4 });

  // Clear cache to test fresh ranking
  const db = mongoose.connection.db;
  await db.collection("cachedsearches").deleteMany({});

  const queries = [
    "General Mathematics",
    "Computer Networks final exam",
    "DBMS exam",
    "DSA PPT",
    "quantum mechanics lecture notes"
  ];

  console.log("=================================================================");
  console.log("PHASE 2.3 PRE-CHANGE BASELINE: TOP 5 RESULTS");
  console.log("=================================================================\n");

  const resultsSummary = {};

  for (const q of queries) {
    console.log(`\n=================================================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`=================================================================`);
    const results = await searchService.searchResources(q, null);
    const top5 = results.slice(0, 5);
    resultsSummary[q] = top5.map(r => ({
      title: r.title,
      fileName: r.fileName,
      score: r.score,
      fileType: r.fileType,
      isExam: r.isExam,
      tags: r.tags
    }));

    top5.forEach((r, i) => {
      console.log(`  ${i + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.fileName || "no-file"}) [Type: ${r.fileType}]`);
    });
  }

  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(
    path.join(__dirname, "phase-2-3-baseline.json"),
    JSON.stringify(resultsSummary, null, 2)
  );

  await mongoose.disconnect();
}

checkBaseline().catch(console.error);
