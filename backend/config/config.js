const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  APP_NAME: 'ASK-DSA API (MERN Edition)',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Production-grade MERN RAG API for Data Structures & Algorithms problem solving and tutoring.',
  DEBUG: process.env.DEBUG === 'true',
  PORT: parseInt(process.env.PORT, 10) || 8000,
  HOST: process.env.HOST || '0.0.0.0',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/askdsa',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  DEFAULT_TOP_K: parseInt(process.env.DEFAULT_TOP_K, 10) || 5,
  CANDIDATE_K: parseInt(process.env.CANDIDATE_K, 10) || 40,
  TEMPERATURE: parseFloat(process.env.TEMPERATURE) || 0.1,
  RATE_LIMIT_DEFAULT: parseInt(process.env.RATE_LIMIT_DEFAULT, 10) || 60,
  RATE_LIMIT_GENERATE: parseInt(process.env.RATE_LIMIT_GENERATE, 10) || 30,
  CHUNKS_PATH: path.resolve(__dirname, '../../data/problem_chunks.json'),
};

module.exports = config;
