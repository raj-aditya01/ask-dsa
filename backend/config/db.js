const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;
let mongoMemoryServer = null;

async function connectDB() {
  if (isConnected) {
    return;
  }

  // 1. First try connecting to specified MONGODB_URI with 3s timeout
  try {
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${config.MONGODB_URI}`);
    return;
  } catch (err) {
    console.warn(`[MongoDB] Could not connect to ${config.MONGODB_URI}: ${err.message}`);
    console.log('[MongoDB] Starting MongoMemoryServer as resilient local fallback...');
  }

  // 2. Resilient fallback: MongoMemoryServer with extended spawn timeout (60s)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create({
      spawn: {
        timeout: 60000,
      },
    });
    const uri = mongoMemoryServer.getUri();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to MongoMemoryServer fallback at: ${uri}`);
  } catch (memErr) {
    console.error(`[MongoDB] Failed to start MongoMemoryServer: ${memErr.message}`);
    // Non-fatal: RAG can still use local in-memory chunks cache
  }
}

async function disconnectDB() {
  if (isConnected) {
    try {
      await mongoose.disconnect();
    } catch (_) {}
    if (mongoMemoryServer) {
      try {
        await mongoMemoryServer.stop();
      } catch (_) {}
    }
    isConnected = false;
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  isConnected: () => isConnected,
};
