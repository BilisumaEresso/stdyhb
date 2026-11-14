const { SUBJECT_ALIASES } = require("./src/config/subjectAliases");

console.log("Total subjects in SUBJECT_ALIASES:", Object.keys(SUBJECT_ALIASES).length);

for (const [key, val] of Object.entries(SUBJECT_ALIASES)) {
  if (!val.aliases || val.aliases.length === 0) {
    console.log(`Subject ${key} has NO aliases!`);
  }
}
