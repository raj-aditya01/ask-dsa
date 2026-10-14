const { tokenize, BM25Okapi } = require('../services/bm25');
const { getRetriever, HybridRetriever } = require('../services/hybridRetriever');

describe('HybridRetriever and BM25 Service', () => {
  test('tokenizes alphanumeric words accurately', () => {
    expect(tokenize('Two Sum II - Input Array Is Sorted')).toEqual([
      'two',
      'sum',
      'ii',
      'input',
      'array',
      'is',
      'sorted',
    ]);
    expect(tokenize('k-th largest element! (Heap)')).toEqual([
      'k',
      'th',
      'largest',
      'element',
      'heap',
    ]);
  });

  test('reciprocal rank fusion handles empty candidates', () => {
    const retriever = getRetriever();
    const merged = retriever._reciprocalRankFusion([], []);
    expect(merged).toEqual([]);
  });

  test('retrieves Two Sum accurately with problem ID 1 as top hit', () => {
    const retriever = getRetriever();
    const response = retriever.retrieve('Two Sum', 3);

    expect(response).toHaveProperty('routing');
    expect(response).toHaveProperty('results');
    expect(response.results.length).toBeGreaterThan(0);

    const topHit = response.results[0];
    expect(topHit.title).toBe('Two Sum');
    expect(topHit.problem_id).toBe('1');
    expect(topHit.rerank_score).toBeDefined();
  });
});
