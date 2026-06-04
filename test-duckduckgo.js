// Test if duck-duck-scrape module loads correctly
try {
  const { search } = require("duck-duck-scrape");
  console.log("✓ duck-duck-scrape loaded successfully");
  
  // Try a simple search
  search("test", { safeSearch: "on" })
    .then((results) => {
      console.log(`✓ Search works! Got ${results.length} results`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("✗ Search error:", err.message);
      process.exit(1);
    });
} catch (err) {
  console.error("✗ Module load error:", err.message);
  process.exit(1);
}
