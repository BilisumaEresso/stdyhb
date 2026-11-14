const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function testSearchQueries() {
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

  // Import the real search service
  const searchService = require('../../src/search/search.service');

  const queries = [
    "DBMS",
    "DSA",
    "General Mathematics",
    "Mathematics for Natural Sciences",
    "Mathematics for Social Sciences",
    "General Physics",
    "Grade 8 Mathematics",
    "Grade 10 Biology",
    "Grade 12 Chemistry",
    "Communicative English",
    "Logic and Critical Thinking",
    "Geography of Ethiopia and the Horn",
    "Social Anthropology",
    "Amharic fiction",
    "Afaan Oromo literature",
    "AAU Nursing",
    "Jimma University Psychology",
    "Freshman Natural Science",
    "Freshman Social Science"
  ];

  console.log(`=== RUNNING SEARCH QUALITY AUDIT ACROSS ${queries.length} REALISTIC QUERIES ===\n`);

  const auditResults = [];

  for (const q of queries) {
    const t0 = Date.now();
    try {
      // search without user personalization to test baseline
      const results = await searchService.searchResources(q, null);
      const latencyMs = Date.now() - t0;

      // Analyze results
      const totalReturned = results.length;
      const top5 = results.slice(0, 5).map(r => ({
        title: r.title,
        type: r.type,
        fileType: r.fileType,
        score: r.score,
        channel: r.channelUsername,
        isGrouped: !!r._isGrouped,
        groupSize: r.groupSize || 1,
        source: r.source
      }));

      // Count unique titles / duplicate fileUniqueIds
      const titleSet = new Set();
      let duplicateTitles = 0;
      results.forEach(r => {
        const norm = (r.title || '').toLowerCase().trim();
        if (titleSet.has(norm)) duplicateTitles++;
        else titleSet.add(norm);
      });

      // Quick relevance check heuristics based on query terms
      const queryTerms = q.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "for" && w !== "and" && w !== "the");
      let relevantInTop5 = 0;
      top5.forEach(r => {
        const titleLower = (r.title || '').toLowerCase();
        const matches = queryTerms.filter(t => titleLower.includes(t));
        if (matches.length >= Math.min(2, queryTerms.length)) {
          relevantInTop5++;
        }
      });

      console.log(`Query: "${q.padEnd(35)}" | Results: ${String(totalReturned).padStart(4)} | Latency: ${String(latencyMs).padStart(5)}ms | Rel@5: ${relevantInTop5}/5 | DupTitles: ${duplicateTitles}`);
      if (top5[0]) {
        console.log(`   Top 1: [${top5[0].fileType || top5[0].type}] "${top5[0].title}" (score: ${top5[0].score}, @${top5[0].channel})`);
      }

      auditResults.push({
        query: q,
        latencyMs,
        totalReturned,
        relevantInTop5,
        duplicateTitles,
        top5
      });
    } catch (err) {
      console.error(`Error searching "${q}":`, err.message);
      auditResults.push({
        query: q,
        error: err.message
      });
    }
  }

  fs.writeFileSync('docs/data-audit/07-search-quality.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    queriesCount: queries.length,
    results: auditResults
  }, null, 2));

  console.log('\nWrote docs/data-audit/07-search-quality.json');

  await mongoose.disconnect();
}

testSearchQueries().catch(console.error);
