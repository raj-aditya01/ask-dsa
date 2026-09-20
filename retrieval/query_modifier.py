import re
from typing import Any, Dict, List, Optional


TOPIC_ALIASES: Dict[str, str] = {
    "two pointer": "Two Pointers",
    "two pointers": "Two Pointers",
    "sliding window": "Sliding Window",
    "binary search": "Binary Search",
    "dynamic programming": "Dynamic Programming",
    "dp": "Dynamic Programming",
    "backtracking": "Backtracking",
    "graph": "Graph",
    "graphs": "Graph",
    "tree": "Tree",
    "trees": "Tree",
    "linked list": "Linked List",
    "linked lists": "Linked List",
    "stack": "Stack",
    "stacks": "Stack",
    "queue": "Queue",
    "queues": "Queue",
    "heap": "Heap (Priority Queue)",
    "priority queue": "Heap (Priority Queue)",
    "hash table": "Hash Table",
    "hash map": "Hash Table",
    "hashing": "Hash Table",
    "array": "Array",
    "arrays": "Array",
    "string": "String",
    "strings": "String",
    "bfs": "Breadth-First Search",
    "dfs": "Depth-First Search",
    "greedy": "Greedy",
    "bit manipulation": "Bit Manipulation",
    "union find": "Union Find",
    "trie": "Trie",
    "divide and conquer": "Divide and Conquer",
    "recursion": "Recursion",
    "memoization": "Dynamic Programming",
    "monotonic stack": "Stack",
    "prefix sum": "Prefix Sum",
}

DIFFICULTIES: Dict[str, str] = {
    "easy": "Easy",
    "medium": "Medium",
    "hard": "Hard",
}

# Conversational prefix and suffix patterns commonly found in user queries
CONVERSATIONAL_PATTERNS = [
    r"^explain\s+(?:the\s+)?(?:problem\s+of\s+|problem\s+)?",
    r"^how\s+(?:can|do)\s+i\s+solve\s+(?:the\s+)?(?:problem\s+of\s+)?",
    r"^i\s+want\s+to\s+understand\s+(?:the\s+)?(?:main\s+idea\s+(?:and\s+algorithm\s+used\s+for\s+)?)?",
    r"^can\s+you\s+show\s+me\s+(?:a\s+|an\s+)?(?:[\w\s,()]+)?problem\s+related\s+to\s+",
    r"^how\s+would\s+you\s+explain\s+(?:the\s+)?(?:solution\s+for\s+)?",
    r"^give\s+me\s+(?:the\s+)?(?:solution\s+for\s+)?",
    r"^what\s+is\s+(?:the\s+)?(?:approach\s+for\s+)?",
    r"\s+in\s+a\s+technical\s+interview\??$",
    r"\s+and\s+explain\s+how\s+to\s+approach\s+it\??$",
    r"\s+problem\??$",
]


def detect_difficulty(query_lower: str) -> Optional[str]:
    """Detect difficulty mentioned in query text."""
    for word, value in DIFFICULTIES.items():
        if re.search(r"\b" + re.escape(word) + r"\b", query_lower):
            return value
    return None


def detect_topics(query_lower: str) -> List[str]:
    """Detect all relevant DSA topic tags mentioned in query."""
    detected = []
    # Sort aliases by length descending so longer phrases match first
    for phrase, canonical in sorted(
        TOPIC_ALIASES.items(), key=lambda x: len(x[0]), reverse=True
    ):
        if re.search(r"\b" + re.escape(phrase) + r"\b", query_lower):
            if canonical not in detected:
                detected.append(canonical)
    return detected


def clean_search_query(query: str) -> str:
    """
    Extract the core problem title or concept from conversational user questions.
    Example: 'Explain the Shortest Path in Binary Matrix problem.' -> 'Shortest Path in Binary Matrix'
    """
    cleaned = query.strip()
    changed = True

    while changed:
        prev = cleaned
        # Strip trailing punctuation first so suffix regexes match cleanly
        cleaned = re.sub(r"[?!.,;:]+$", "", cleaned).strip()
        for pattern in CONVERSATIONAL_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"[?!.,;:]+$", "", cleaned).strip()
        changed = (cleaned != prev)

    return cleaned if cleaned else query.strip()


def modify_query(query: str) -> Dict[str, Any]:
    """
    Extract structured search metadata without polluting the core semantic query.
    """
    original_query = query.strip()
    query_lower = original_query.lower()

    difficulty = detect_difficulty(query_lower)
    topics = detect_topics(query_lower)
    primary_topic = topics[0] if topics else None
    cleaned_query = clean_search_query(original_query)

    return {
        "original_query": original_query,
        "cleaned_query": cleaned_query,
        "modified_query": cleaned_query,
        "difficulty": difficulty,
        "topic": primary_topic,
        "topics": topics,
    }


if __name__ == "__main__":
    test_queries = [
        "Explain the Shortest Path in Binary Matrix problem.",
        "How can I solve the problem of random pick with blacklist?",
        "Can you show me a Array, Hash Table problem related to merge two 2d arrays by summing values and explain how to approach it?",
        "How would you explain the solution for Best Time to Buy and Sell Stock III in a technical interview?",
    ]
    for q in test_queries:
        print(modify_query(q))
