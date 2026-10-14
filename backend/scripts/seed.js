const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../config/db');
const Problem = require('../models/Problem');
const config = require('../config/config');

async function seed() {
  console.log('[Seed] Initializing database seeding...');
  await connectDB();

  const chunksPath = config.CHUNKS_PATH;
  if (!fs.existsSync(chunksPath)) {
    console.error(`[Seed] Data file not found at: ${chunksPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(chunksPath, 'utf8');
  const chunks = JSON.parse(raw);
  console.log(`[Seed] Loaded ${chunks.length} problem chunks from disk.`);

  const existingCount = await Problem.countDocuments();
  console.log(`[Seed] Current problems in DB: ${existingCount}`);

  if (existingCount >= chunks.length) {
    console.log('[Seed] Database is already populated. Skipping insert.');
    await disconnectDB();
    return;
  }

  console.log('[Seed] Clearing old entries...');
  await Problem.deleteMany({});

  console.log('[Seed] Inserting problem chunks in batches...');
  const batchSize = 500;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((item) => ({
      problem_id: String(item.problem_id),
      title: item.title,
      difficulty: item.difficulty || 'Unknown',
      topics: Array.isArray(item.topics) ? item.topics : [],
      category: item.category || 'Algorithms',
      chunk_id: item.chunk_id || 0,
      text: item.text,
    }));
    await Problem.insertMany(batch);
    console.log(`[Seed] Inserted ${Math.min(i + batchSize, chunks.length)} / ${chunks.length} records.`);
  }

  const finalCount = await Problem.countDocuments();
  console.log(`[Seed] Seeding completed successfully! Total records: ${finalCount}`);

  await disconnectDB();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = seed;
