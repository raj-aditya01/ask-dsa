const {
  formatContext,
  DSAGenerator,
  SYSTEM_PROMPT,
} = require('../services/generator');

describe('Generator Service', () => {
  test('formatContext handles empty input gracefully', () => {
    expect(formatContext(null)).toBe('No relevant documents were retrieved.');
    expect(formatContext([])).toBe('No relevant documents were retrieved.');
    expect(formatContext({ results: [] })).toBe(
      'No relevant documents were retrieved.'
    );
  });

  test('formatContext formats problem objects into grounded context sections', () => {
    const mockProblems = [
      {
        problem_id: '1',
        title: 'Two Sum',
        difficulty: 'Easy',
        category: 'Algorithms',
        topics: ['Array', 'Hash Table'],
        text: 'Given an array of integers nums...',
      },
    ];

    const formatted = formatContext(mockProblems);
    expect(formatted).toContain('Problem ID: 1');
    expect(formatted).toContain('Title: Two Sum');
    expect(formatted).toContain('Difficulty: Easy');
    expect(formatted).toContain('Topics: Array, Hash Table');
    expect(formatted).toContain('Given an array of integers nums...');
  });

  test('buildMessages correctly formats system prompt and user question', () => {
    const generator = new DSAGenerator('mock_key');
    const messages = generator.buildMessages('How to detect a cycle in a linked list?', []);

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(SYSTEM_PROMPT);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('User Question:');
    expect(messages[1].content).toContain('How to detect a cycle in a linked list?');
  });

  test('generator throws error when API key is missing', async () => {
    const generator = new DSAGenerator('');
    await expect(generator.generate('test query', [])).rejects.toThrow(
      'Groq API key not configured!'
    );
  });
});
