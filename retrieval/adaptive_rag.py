import re
from typing import Any, Dict

from retrieval.query_modifier import modify_query


def classify_query(query: str) -> Dict[str, Any]:
    """
    Route queries to optimal retrieval parameters and strategies.
    
    Strategies:
    - 'specific_qa' (default for problem QA): High precision Title-BM25 + Dense + Cross-Encoder Reranking (NO MMR)
    - 'exploratory' (diverse problems, multiple techniques): Hybrid + MMR for diversity
    """
    query_info = modify_query(query)
    text = query_info["original_query"].lower()

    # Signals indicating the user wants a diverse set of distinct problems or comparison
    exploratory_signals = [
        "give me 5" in text or "give me 3" in text or "list of" in text,
        "different" in text and ("problems" in text or "approaches" in text),
        "compare" in text and "vs" in text,
        "various" in text,
    ]

    is_exploratory = any(exploratory_signals)

    if is_exploratory:
        strategy = "exploratory"
        use_mmr = True
        candidate_k = 40
        top_k = 8
    else:
        strategy = "specific_qa"
        use_mmr = False
        candidate_k = 40
        top_k = 5

    return {
        **query_info,
        "strategy": strategy,
        "use_hybrid": True,
        "use_mmr": use_mmr,
        "top_k": top_k,
        "candidate_k": candidate_k,
    }
