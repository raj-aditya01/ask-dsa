import json
from pathlib import Path
from collections import Counter


# ============================================================
# CONFIG
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESULTS_FILE = PROJECT_ROOT / "evaluation" / "data" / "retrieval_results.jsonl"
FAILURE_REPORT_FILE = PROJECT_ROOT / "evaluation" / "data" / "failure_report.jsonl"

TOP_K = 5


# ============================================================
# LOAD RESULTS
# ============================================================

def load_results():
    results = []

    with RESULTS_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if not line:
                continue

            results.append(json.loads(line))

    return results


# ============================================================
# ANALYZE FAILURES
# ============================================================

def analyze_failures(results):
    failures = []

    for item in results:

        recall = item.get("recall_at_5", 0)

        # Recall@5 = 0 means expected problem
        # was NOT found in top 5
        if recall == 0:

            relevant_ids = set(
                str(problem_id)
                for problem_id in item.get(
                    "relevant_problem_ids",
                    []
                )
            )

            retrieved_results = item.get(
                "retrieved_results",
                []
            )

            top_results = []

            for result in retrieved_results[:TOP_K]:

                top_results.append({
                    "problem_id": result.get("problem_id"),
                    "title": result.get("title"),
                    "score": result.get("score"),
                    "chunk_id": result.get("chunk_id")
                })

            failures.append({
                "query": item.get("query"),
                "expected_problem_ids": list(relevant_ids),
                "top_5_retrieved": top_results,
                "latency_ms": item.get("latency_ms")
            })

    return failures


# ============================================================
# PRINT FAILURE SUMMARY
# ============================================================

def print_failure_summary(failures):

    print()
    print("=" * 70)
    print("RETRIEVAL FAILURE ANALYSIS")
    print("=" * 70)

    print()
    print(f"Total Recall@5 failures: {len(failures)}")

    if not failures:
        print()
        print("No Recall@5 failures found!")
        return

    print()
    print("Showing first 20 failures:")
    print("-" * 70)

    for index, failure in enumerate(failures[:20], start=1):

        print()
        print(f"FAILURE #{index}")

        print(f"Query:")
        print(f"  {failure['query']}")

        print()
        print("Expected Problem ID(s):")
        print(f"  {failure['expected_problem_ids']}")

        print()
        print("Top 5 Retrieved:")

        for rank, result in enumerate(
            failure["top_5_retrieved"],
            start=1
        ):

            print(
                f"  {rank}. "
                f"ID={result.get('problem_id')} | "
                f"Title={result.get('title')} | "
                f"Score={result.get('score')}"
            )

        print()
        print("-" * 70)


# ============================================================
# SAVE FAILURE REPORT
# ============================================================

def save_failure_report(failures):

    with FAILURE_REPORT_FILE.open(
        "w",
        encoding="utf-8"
    ) as f:

        for failure in failures:

            f.write(
                json.dumps(
                    failure,
                    ensure_ascii=False
                )
                + "\n"
            )

    print()
    print(
        f"Failure report saved to: "
        f"{FAILURE_REPORT_FILE}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    if not RESULTS_FILE.exists():

        print()
        print("ERROR:")
        print(
            f"Results file not found: "
            f"{RESULTS_FILE}"
        )

        print()
        print(
            "First run:"
        )

        print(
            "python evaluation/evaluate_retriever.py"
        )

        return

    print()
    print("Loading retrieval evaluation results...")

    results = load_results()

    print(
        f"Loaded {len(results)} evaluation results."
    )

    failures = analyze_failures(results)

    print_failure_summary(failures)

    save_failure_report(failures)

    print()
    print("=" * 70)
    print("ANALYSIS COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()