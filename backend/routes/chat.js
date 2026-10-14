const express = require('express');
const router = express.Router();
const { getRetriever } = require('../services/hybridRetriever');
const { getGenerator } = require('../services/generator');
const QueryHistory = require('../models/QueryHistory');

/**
 * POST /api/v1/ask - Synchronous RAG Generation
 */
router.post('/', async (req, res) => {
  const { query, top_k, include_sources = true } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query must be a string with at least 2 characters.',
      },
    });
  }

  const overallStart = process.hrtime();
  const retriever = getRetriever();
  const generator = getGenerator();
  const finalTopK = top_k ? parseInt(top_k, 10) : undefined;

  try {
    // 1. Retrieve candidates
    const retStart = process.hrtime();
    const retrievalOutput = retriever.retrieve(query.trim(), finalTopK);
    const retDiff = process.hrtime(retStart);
    const retrievalMs = parseFloat(((retDiff[0] * 1e9 + retDiff[1]) / 1e6).toFixed(2));

    // 2. Generate answer with Groq LLM
    const genStart = process.hrtime();
    const answer = await generator.generate(query.trim(), retrievalOutput.results);
    const genDiff = process.hrtime(genStart);
    const genMs = parseFloat(((genDiff[0] * 1e9 + genDiff[1]) / 1e6).toFixed(2));

    const totalDiff = process.hrtime(overallStart);
    const totalMs = parseFloat(((totalDiff[0] * 1e9 + totalDiff[1]) / 1e6).toFixed(2));

    const responsePayload = {
      query: query.trim(),
      answer,
      sources: include_sources ? retrievalOutput.results : [],
      routing: retrievalOutput.routing,
      metrics: {
        retrieval_ms: retrievalMs,
        generation_ms: genMs,
        total_ms: totalMs,
      },
    };

    // Asynchronously log query history in MongoDB if available
    try {
      QueryHistory.create({
        query: query.trim(),
        cleanedQuery: retrievalOutput.routing.cleaned_query,
        strategy: retrievalOutput.routing.strategy,
        topic: retrievalOutput.routing.topic,
        difficulty: retrievalOutput.routing.difficulty,
        resultsCount: retrievalOutput.results.length,
        topResults: retrievalOutput.results.slice(0, 3).map((r) => ({
          problem_id: r.problem_id,
          title: r.title,
          difficulty: r.difficulty,
          score: r.score,
          rerank_score: r.rerank_score,
        })),
        answer,
        metrics: responsePayload.metrics,
      }).catch(() => {});
    } catch (_) {}

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[Ask Error]', err);
    return res.status(502).json({
      error: {
        code: 'LLM_PROVIDER_ERROR',
        message: err.message || 'Error occurred communicating with Groq LLM',
      },
    });
  }
});

/**
 * Common SSE Stream handler for both POST and GET /api/v1/ask/stream
 */
async function handleStream(req, res, query, topK, includeSources) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query must be a string with at least 2 characters.',
      },
    });
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const overallStart = process.hrtime();
  const retriever = getRetriever();
  const generator = getGenerator();
  const finalTopK = topK ? parseInt(topK, 10) : undefined;

  let accumulatedAnswer = '';
  let retrievalOutput = null;

  try {
    // 1. Retrieve candidates
    const retStart = process.hrtime();
    retrievalOutput = retriever.retrieve(query.trim(), finalTopK);
    const retDiff = process.hrtime(retStart);
    const retrievalMs = parseFloat(((retDiff[0] * 1e9 + retDiff[1]) / 1e6).toFixed(2));

    // Emit initial metadata event
    const metaPayload = {
      type: 'metadata',
      routing: retrievalOutput.routing,
      sources: includeSources ? retrievalOutput.results : [],
      retrieval_ms: retrievalMs,
    };
    res.write(`data: ${JSON.stringify(metaPayload)}\n\n`);

    // 2. Stream tokens from Groq LLM
    for await (const token of generator.stream(query.trim(), retrievalOutput.results)) {
      accumulatedAnswer += token;
      const tokenPayload = { type: 'token', content: token };
      res.write(`data: ${JSON.stringify(tokenPayload)}\n\n`);
    }

    const totalDiff = process.hrtime(overallStart);
    const totalMs = parseFloat(((totalDiff[0] * 1e9 + totalDiff[1]) / 1e6).toFixed(2));

    const donePayload = { type: 'done', total_ms: totalMs };
    res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
    res.end();

    // Log query in background
    try {
      QueryHistory.create({
        query: query.trim(),
        cleanedQuery: retrievalOutput.routing.cleaned_query,
        strategy: retrievalOutput.routing.strategy,
        topic: retrievalOutput.routing.topic,
        difficulty: retrievalOutput.routing.difficulty,
        resultsCount: retrievalOutput.results.length,
        topResults: retrievalOutput.results.slice(0, 3).map((r) => ({
          problem_id: r.problem_id,
          title: r.title,
          difficulty: r.difficulty,
          score: r.score,
          rerank_score: r.rerank_score,
        })),
        answer: accumulatedAnswer,
        metrics: {
          retrieval_ms: retrievalMs,
          generation_ms: parseFloat((totalMs - retrievalMs).toFixed(2)),
          total_ms: totalMs,
        },
      }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error('[Stream Error]', err);
    const errPayload = {
      type: 'error',
      message: err.message || 'Failed during generation stream',
    };
    res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
    res.end();
  }
}

router.post('/stream', (req, res) => {
  const { query, top_k, include_sources = true } = req.body || {};
  return handleStream(req, res, query, top_k, include_sources);
});

router.get('/stream', (req, res) => {
  const { query, top_k, include_sources = 'true' } = req.query || {};
  const includeSourcesBool = include_sources !== 'false' && include_sources !== false;
  return handleStream(req, res, query, top_k, includeSourcesBool);
});

module.exports = router;
