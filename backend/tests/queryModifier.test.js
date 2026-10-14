const {
  detectDifficulty,
  detectTopics,
  cleanSearchQuery,
  modifyQuery,
} = require('../services/queryModifier');

describe('QueryModifier Service', () => {
  test('detects difficulty accurately', () => {
    expect(detectDifficulty('easy two sum problem')).toBe('Easy');
    expect(
      detectDifficulty('how to solve this medium dynamic programming problem?')
    ).toBe('Medium');
    expect(detectDifficulty('a very hard graph problem')).toBe('Hard');
    expect(detectDifficulty('just binary search')).toBeNull();
  });

  test('detects topics and aliases', () => {
    const topics = detectTopics('explain binary search on a sorted array');
    expect(topics).toContain('Binary Search');
    expect(topics).toContain('Array');

    const dpTopics = detectTopics('how to solve with memoization and dp');
    expect(dpTopics).toContain('Dynamic Programming');

    const heapTopics = detectTopics('using priority queue to find min');
    expect(heapTopics).toContain('Heap (Priority Queue)');

    const twoPointers = detectTopics('two pointer technique');
    expect(twoPointers).toContain('Two Pointers');
  });

  test('cleans conversational queries', () => {
    expect(
      cleanSearchQuery('Explain the Shortest Path in Binary Matrix problem.')
    ).toBe('Shortest Path in Binary Matrix');
    expect(
      cleanSearchQuery('How can I solve the problem of random pick with blacklist?')
    ).toBe('random pick with blacklist');
    expect(
      cleanSearchQuery(
        'How would you explain the solution for Two Sum in a technical interview?'
      )
    ).toBe('Two Sum');
    expect(
      cleanSearchQuery(
        'I want to understand the main idea and algorithm used for merge intervals.'
      )
    ).toBe('merge intervals');
  });

  test('modifyQuery returns full structured metadata', () => {
    const result = modifyQuery('Explain the Shortest Path in Binary Matrix problem.');
    expect(result).toHaveProperty('original_query');
    expect(result).toHaveProperty('cleaned_query');
    expect(result).toHaveProperty('modified_query');
    expect(result).toHaveProperty('difficulty');
    expect(result).toHaveProperty('topic');
    expect(result).toHaveProperty('topics');
    expect(result.cleaned_query).toBe('Shortest Path in Binary Matrix');
    expect(result.modified_query).toBe(result.cleaned_query);
  });
});
