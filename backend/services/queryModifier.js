/**
 * Query Modifier Service (faithful port of retrieval/query_modifier.py)
 * Extracts structured search metadata and strips conversational filler without polluting core query.
 */

const TOPIC_ALIASES = {
  'two pointer': 'Two Pointers',
  'two pointers': 'Two Pointers',
  'sliding window': 'Sliding Window',
  'binary search': 'Binary Search',
  'dynamic programming': 'Dynamic Programming',
  'dp': 'Dynamic Programming',
  'backtracking': 'Backtracking',
  'graph': 'Graph',
  'graphs': 'Graph',
  'tree': 'Tree',
  'trees': 'Tree',
  'linked list': 'Linked List',
  'linked lists': 'Linked List',
  'stack': 'Stack',
  'stacks': 'Stack',
  'queue': 'Queue',
  'queues': 'Queue',
  'heap': 'Heap (Priority Queue)',
  'priority queue': 'Heap (Priority Queue)',
  'hash table': 'Hash Table',
  'hash map': 'Hash Table',
  'hashing': 'Hash Table',
  'array': 'Array',
  'arrays': 'Array',
  'string': 'String',
  'strings': 'String',
  'bfs': 'Breadth-First Search',
  'dfs': 'Depth-First Search',
  'greedy': 'Greedy',
  'bit manipulation': 'Bit Manipulation',
  'union find': 'Union Find',
  'trie': 'Trie',
  'divide and conquer': 'Divide and Conquer',
  'recursion': 'Recursion',
  'memoization': 'Dynamic Programming',
  'monotonic stack': 'Stack',
  'prefix sum': 'Prefix Sum',
};

const DIFFICULTIES = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const CONVERSATIONAL_PATTERNS = [
  /^explain\s+(?:the\s+)?(?:problem\s+of\s+|problem\s+)?/i,
  /^how\s+(?:can|do)\s+i\s+solve\s+(?:the\s+)?(?:problem\s+of\s+)?/i,
  /^i\s+want\s+to\s+understand\s+(?:the\s+)?(?:main\s+idea\s+(?:and\s+algorithm\s+used\s+for\s+)?)?/i,
  /^can\s+you\s+show\s+me\s+(?:a\s+|an\s+)?(?:[\w\s,()]+)?problem\s+related\s+to\s+/i,
  /^how\s+would\s+you\s+explain\s+(?:the\s+)?(?:solution\s+for\s+)?/i,
  /^give\s+me\s+(?:the\s+)?(?:solution\s+for\s+)?/i,
  /^what\s+is\s+(?:the\s+)?(?:approach\s+for\s+)?/i,
  /\s+in\s+a\s+technical\s+interview\??$/i,
  /\s+and\s+explain\s+how\s+to\s+approach\s+it\??$/i,
  /\s+problem\??$/i,
];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect difficulty mentioned in query text.
 */
function detectDifficulty(queryLower) {
  for (const [word, value] of Object.entries(DIFFICULTIES)) {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    if (regex.test(queryLower)) {
      return value;
    }
  }
  return null;
}

/**
 * Detect all relevant DSA topic tags mentioned in query.
 */
function detectTopics(queryLower) {
  const detected = [];
  // Sort aliases by length descending so longer phrases match first
  const sortedAliases = Object.entries(TOPIC_ALIASES).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [phrase, canonical] of sortedAliases) {
    const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');
    if (regex.test(queryLower)) {
      if (!detected.includes(canonical)) {
        detected.push(canonical);
      }
    }
  }
  return detected;
}

/**
 * Extract the core problem title or concept from conversational user questions.
 * Example: 'Explain the Shortest Path in Binary Matrix problem.' -> 'Shortest Path in Binary Matrix'
 */
function cleanSearchQuery(query) {
  let cleaned = (query || '').trim();
  let changed = true;

  while (changed) {
    const prev = cleaned;
    // Strip trailing punctuation first so suffix regexes match cleanly
    cleaned = cleaned.replace(/[?!.,;:]+$/, '').trim();
    for (const pattern of CONVERSATIONAL_PATTERNS) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    cleaned = cleaned.replace(/[?!.,;:]+$/, '').trim();
    changed = cleaned !== prev;
  }

  return cleaned.length > 0 ? cleaned : (query || '').trim();
}

/**
 * Extract structured search metadata without polluting the core semantic query.
 */
function modifyQuery(query) {
  const originalQuery = (query || '').trim();
  const queryLower = originalQuery.toLowerCase();

  const difficulty = detectDifficulty(queryLower);
  const topics = detectTopics(queryLower);
  const primaryTopic = topics.length > 0 ? topics[0] : null;
  const cleanedQuery = cleanSearchQuery(originalQuery);

  return {
    original_query: originalQuery,
    cleaned_query: cleanedQuery,
    modified_query: cleanedQuery,
    difficulty,
    topic: primaryTopic,
    topics,
  };
}

module.exports = {
  TOPIC_ALIASES,
  DIFFICULTIES,
  CONVERSATIONAL_PATTERNS,
  detectDifficulty,
  detectTopics,
  cleanSearchQuery,
  modifyQuery,
};
