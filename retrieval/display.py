def print_results(response):
    routing = response.get("routing", {})
    results = response.get("results", [])

    print("\n========== QUERY ROUTING ==========")
    print("Original Query :", routing.get("original_query", ""))
    print("Modified Query :", routing.get("cleaned_query") or routing.get("modified_query", ""))
    print("Difficulty     :", routing.get("difficulty"))
    print("Topic          :", routing.get("topic"))
    print("Strategy       :", routing.get("strategy"))
    print("Hybrid         :", routing.get("use_hybrid"))
    print("MMR            :", routing.get("use_mmr"))

    print("\n========== SEARCH RESULTS ==========\n")

    if not results:
        print("No results found.")
        return

    for index, result in enumerate(results, start=1):
        score = result.get("rerank_score", result.get("score", 0.0))
        formatted_score = f"{score:.5f}" if isinstance(score, (int, float)) else str(score)

        print(f"Result {index}")
        print("Title:", result.get("title", "Unknown"))
        print("Difficulty:", result.get("difficulty", "Unknown"))
        print("Topics:", result.get("topics", []))
        print("Category:", result.get("category", "Unknown"))
        print("Problem ID:", result.get("problem_id", "Unknown"))
        print("Score:", formatted_score)
        print("\nContent:")
        print(result.get("text", "")[:500])
        print("\n" + "-" * 60)

