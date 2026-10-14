const express = require('express');
const router = express.Router();
const config = require('../config/config');
const { isConnected } = require('../config/db');
const { getRetriever } = require('../services/hybridRetriever');

function healthHandler(req, res) {
  const retriever = getRetriever();
  const retrievalReady = retriever.chunks.length > 0;
  const llmReady = Boolean(config.GROQ_API_KEY && config.GROQ_API_KEY.length > 0);

  res.status(200).json({
    status: 'healthy',
    version: config.APP_VERSION,
    retrieval_ready: retrievalReady,
    llm_ready: llmReady,
    model: config.GROQ_MODEL,
    db_connected: isConnected(),
    chunks_count: retriever.chunks.length,
  });
}

router.get('/', healthHandler);
router.get('/health', healthHandler);

module.exports = router;
