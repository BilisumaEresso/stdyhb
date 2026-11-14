/**
 * db-helper.js
 * 
 * Resilient MongoDB Atlas connection helper for Phase 1.1.
 * Enforces IPv4 DNS resolution, socket timeouts, and retry logic.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function connectToMongo(customUri = null, maxRetries = 3) {
  const uri = customUri || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MongoDB connection URI is missing");
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      await client.connect();
      return client;
    } catch (err) {
      console.warn(`[db-helper] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt >= maxRetries) {
        throw err;
      }
      await new Promise(res => setTimeout(res, 2000 * attempt));
    }
  }
}

module.exports = {
  connectToMongo
};
