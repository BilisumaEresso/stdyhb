const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");

async function checkOplog() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const localDb = mongoose.connection.client.db("local");
  const oplog = localDb.collection("oplog.rs");

  try {
    const stats = await localDb.command({ collStats: "oplog.rs" }).catch(() => null);
    console.log(`Oplog Configured Size: ${(stats?.maxSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Oplog Current Size:    ${(stats?.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Oplog Document Count:  ${stats?.count || 'N/A'}`);

    const first = await oplog.find({}).sort({ $natural: 1 }).limit(1).project({ ts: 1 }).toArray();
    const last = await oplog.find({}).sort({ $natural: -1 }).limit(1).project({ ts: 1 }).toArray();

    if (first[0] && last[0]) {
      const tFirst = new Date(first[0].ts.getHighBits() * 1000);
      const tLast = new Date(last[0].ts.getHighBits() * 1000);
      const durationHours = ((tLast - tFirst) / 1000 / 3600).toFixed(2);
      console.log(`Oldest Oplog Entry:    ${tFirst.toISOString()}`);
      console.log(`Newest Oplog Entry:    ${tLast.toISOString()}`);
      console.log(`Oplog Retention Window: ${durationHours} hours`);
    }
  } catch (err) {
    console.warn("Could not read oplog details:", err.message);
  }

  await mongoose.disconnect();
}

checkOplog().catch(console.error);
