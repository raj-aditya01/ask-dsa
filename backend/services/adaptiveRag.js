/**
 * Adaptive RAG Routing Service (faithful port of retrieval/adaptive_rag.py)
 * Routes queries to optimal retrieval parameters and strategies.
 */

const { modifyQuery } = require('./queryModifier');

function classifyQuery(query) {
  const queryInfo = modifyQuery(query);
  const text = queryInfo.original_query.toLowerCase();

  // Signals indicating the user wants a diverse set of distinct problems or comparison
  const exploratorySignals = [
    text.includes('give me 5') || text.includes('give me 3') || text.includes('list of'),
    text.includes('different') && (text.includes('problems') || text.includes('approaches')),
    text.includes('compare') && text.includes('vs'),
    text.includes('various'),
  ];

  const isExploratory = exploratorySignals.some(Boolean);

  let strategy;
  let useMmr;
  let candidateK;
  let topK;

  if (isExploratory) {
    strategy = 'exploratory';
    useMmr = true;
    candidateK = 40;
    topK = 8;
  } else {
    strategy = 'specific_qa';
    useMmr = false;
    candidateK = 40;
    topK = 5;
  }

  return {
    ...queryInfo,
    strategy,
    use_hybrid: true,
    use_mmr: useMmr,
    top_k: topK,
    candidate_k: candidateK,
  };
}

module.exports = {
  classifyQuery,
};
