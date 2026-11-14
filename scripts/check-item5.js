require("dotenv").config();
const mongoose = require("mongoose");
const searchService = require("../src/search/search.service");

async function checkItem5() {
  await mongoose.connect(process.env.MONGO_URI);
  const results = await searchService.searchResources("logic exam", null);
  const item5 = results.find(r => (r.fileName || "").includes("logic 2014 mid exams collection"));
  console.log("=== Item 5 Details ===");
  console.log("Title:", item5.title);
  console.log("Channel:", item5.channelUsername);
  console.log("Duplicate Count:", item5.duplicateCount);
  console.log("Channel Count:", item5.channelCount);
  console.log("Alternative Sources:", item5.alternativeSources);
  await mongoose.disconnect();
}
checkItem5().catch(console.error);
