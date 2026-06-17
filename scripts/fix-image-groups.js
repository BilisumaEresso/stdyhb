require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // Fetch ungrouped image resources sorted temporally
    const images = await TelegramResource.find({ fileType: "image", groupId: null })
      .sort({ channelUsername: 1, messageId: 1 })
      .lean();

    console.log(`Found ${images.length} ungrouped images. Analyzing...`);

    if (images.length === 0) {
      console.log("Nothing to migrate.");
      process.exit(0);
    }

    let currentCluster = [];
    const bulkOps = [];

    const flushCluster = () => {
      // Only group if there are at least 2 images matching the logic
      if (currentCluster.length > 1) {
        const groupId = currentCluster[0].messageId.toString();
        const groupTotal = currentCluster.length;
        
        currentCluster.forEach((doc, index) => {
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { groupId, groupTotal, groupIndex: index + 1 } }
            }
          });
        });
      }
      currentCluster = [];
    };

    for (let i = 0; i < images.length; i++) {
      const doc = images[i];
      if (currentCluster.length === 0) {
        currentCluster.push(doc);
      } else {
        const last = currentCluster[currentCluster.length - 1];
        
        const sameChannel = last.channelUsername === doc.channelUsername;
        const sameCaption = last.caption === doc.caption;
        
        let timeClose = false;
        if (last.messageDate && doc.messageDate) {
           const diffMs = Math.abs(new Date(last.messageDate).getTime() - new Date(doc.messageDate).getTime());
           timeClose = diffMs <= 60000; // <= 60 seconds
        }

        if (sameChannel && sameCaption && timeClose) {
          currentCluster.push(doc);
        } else {
          flushCluster();
          currentCluster.push(doc);
        }
      }
    }
    
    // Flush the final cluster
    flushCluster();

    if (bulkOps.length > 0) {
      console.log(`Executing ${bulkOps.length} updates...`);
      await TelegramResource.bulkWrite(bulkOps);
      console.log(`✅ Successfully grouped ${bulkOps.length} legacy images.`);
    } else {
      console.log("✅ No clusters matched grouping criteria. Everything is up to date.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
