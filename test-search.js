const { searchWeb } = require("./src/search/providers/websearch");
const { searchGitHub } = require("./src/search/providers/github");

(async () => {
  console.log("\n🧪 Testing Web Search...");
  const webResults = await searchWeb("DBMS pdf");
  console.log(`Web results: ${webResults.length}`);
  if (webResults.length > 0) {
    console.log("Sample:", webResults[0]);
  }

  console.log("\n🧪 Testing GitHub Search...");
  const githubResults = await searchGitHub("DBMS exam");
  console.log(`GitHub results: ${githubResults.length}`);
  if (githubResults.length > 0) {
    console.log("Sample:", githubResults[0]);
  }
})();
