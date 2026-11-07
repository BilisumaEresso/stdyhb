require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramResourceQuarantine = require("../src/db/models/TelegramResourceQuarantine");

async function verify() {
  console.log("====================================================");
  console.log("🧪 PHASE 1 VERIFICATION SUITE");
  console.log("====================================================\n");

  await mongoose.connect(process.env.MONGO_URI);

  const activeSingleImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: null,
    isAvailable: { $ne: false },
  });

  const activeGroupedImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: { $ne: null },
    isAvailable: { $ne: false },
  });

  const quarantinedCount = await TelegramResourceQuarantine.countDocuments({
    quarantineReason: "single_image_non_resource",
  });

  console.log(`1. Active single images count:        ${activeSingleImages} (Expected: 0)`);
  console.log(`2. Active grouped album images count: ${activeGroupedImages} (Expected: 17720)`);
  console.log(`3. Quarantined single images count:   ${quarantinedCount} (Expected: 8651)`);

  let allPassed = true;
  if (activeSingleImages !== 0) {
    console.error("❌ FAILED: activeSingleImages is not 0!");
    allPassed = false;
  }
  if (activeGroupedImages !== 17720) {
    console.error("❌ FAILED: activeGroupedImages count changed!");
    allPassed = false;
  }
  if (quarantinedCount !== 8651) {
    console.error("❌ FAILED: quarantinedCount is not 8651!");
    allPassed = false;
  }

  await mongoose.disconnect();

  if (allPassed) {
    console.log("\n✅ ALL PHASE 1 CHECKS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
