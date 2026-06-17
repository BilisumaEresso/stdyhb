require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const { 
  extractTags, extractCourseCode, extractYear, extractUniversity, extractSemester 
} = require("../src/search/telegramIndexer");

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const totalCount = await TelegramResource.countDocuments();
    console.log(`Found ${totalCount} total resources to process.`);

    if (totalCount === 0) {
      console.log("Nothing to migrate.");
      process.exit(0);
    }

    const BATCH_SIZE = 500;
    let processedCount = 0;
    let updatedCount = 0;
    let bulkOps = [];

    const cursor = TelegramResource.find().cursor();

    for await (const doc of cursor) {
      const { caption, fileName, channelUsername } = doc;
      const combinedText = `${caption || ""} ${fileName || ""} ${channelUsername || ""}`;
      
      const newTags = extractTags(caption || "", fileName || "", channelUsername || "");
      const newCourseCode = extractCourseCode(combinedText);
      const newYear = extractYear(combinedText);
      const newUniversity = extractUniversity(combinedText);
      const newSemester = extractSemester(combinedText);

      const tagsChanged = JSON.stringify(doc.tags) !== JSON.stringify(newTags);
      const courseChanged = doc.courseCode !== newCourseCode;
      const yearChanged = doc.year !== newYear;
      const uniChanged = doc.university !== newUniversity;
      const semChanged = doc.semester !== newSemester;

      if (tagsChanged || courseChanged || yearChanged || uniChanged || semChanged) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { 
              $set: { 
                tags: newTags,
                courseCode: newCourseCode,
                year: newYear,
                university: newUniversity,
                semester: newSemester
              } 
            }
          }
        });
        updatedCount++;
      }

      processedCount++;

      if (bulkOps.length >= BATCH_SIZE) {
        await TelegramResource.bulkWrite(bulkOps);
        console.log(`Processed ${processedCount}/${totalCount}... (Updated ${updatedCount} so far)`);
        bulkOps = []; 
      }
    }

    if (bulkOps.length > 0) {
        await TelegramResource.bulkWrite(bulkOps);
        console.log(`Processed ${processedCount}/${totalCount}... (Updated ${updatedCount} so far)`);
    }

    console.log(`\n✅ Migration Complete!`);
    console.log(`Total Processed: ${processedCount}`);
    console.log(`Total Updated: ${updatedCount}`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
