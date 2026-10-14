const express = require('express');
const router = express.Router();
const { getRetriever } = require('../services/hybridRetriever');

router.post('/', (req, res) => {
  const { query, top_k } = req.body || {};

  // Validation: query required and length >= 2
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query must be a string with at least 2 characters.',
      },
    });
  }

  const startTime = process.hrtime();
  const retriever = getRetriever();
  const finalTopK = top_k ? parseInt(top_k, 10) : undefined;

  try {
    const retrievalOutput = retriever.retrieve(query.trim(), finalTopK);
    const diff = process.hrtime(startTime);
    const retrievalMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));

    return res.status(200).json({
      query: query.trim(),
      total_results: retrievalOutput.results.length,
      routing: retrievalOutput.routing,
      results: retrievalOutput.results,
      metrics: {
        retrieval_ms: retrievalMs,
        total_ms: retrievalMs,
      },
    });
  } catch (err) {
    console.error('[Retrieval Error]', err);
    return res.status(500).json({
      error: {
        code: 'RETRIEVAL_ERROR',
        message: err.message || 'Error occurred during candidate retrieval',
      },
    });
  }
});

module.exports = router;
