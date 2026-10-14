const { classifyQuery } = require('../services/adaptiveRag');

describe('Adaptive RAG Routing Service', () => {
  test('routes to specific_qa strategy by default', () => {
    const result = classifyQuery('Explain the Two Sum problem.');
    expect(result.strategy).toBe('specific_qa');
    expect(result.use_mmr).toBe(false);
    expect(result.top_k).toBe(5);
    expect(result.candidate_k).toBe(40);
    expect(result.cleaned_query).toBe('Two Sum');
  });

  test('routes to exploratory strategy for diverse queries', () => {
    const res1 = classifyQuery('give me 5 dynamic programming problems');
    expect(res1.strategy).toBe('exploratory');
    expect(res1.use_mmr).toBe(true);
    expect(res1.top_k).toBe(8);

    const res2 = classifyQuery('compare bfs vs dfs approaches');
    expect(res2.strategy).toBe('exploratory');
    expect(res2.use_mmr).toBe(true);

    const res3 = classifyQuery('different sliding window problems');
    expect(res3.strategy).toBe('exploratory');
    expect(res3.use_mmr).toBe(true);
  });
});
