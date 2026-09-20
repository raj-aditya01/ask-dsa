
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import json
import time
import statistics

from retrieval.hybrid_retriever import HybridRetriever


# =========================
# FILE PATHS
# =========================

EVAL_FILE = PROJECT_ROOT / "evaluation" / "data" / "synthetic_eval.jsonl"

# Number of results considered for Recall
TOP_K = 5

# Detailed results will be saved here
RESULTS_FILE = PROJECT_ROOT / "evaluation" / "data" / "retrieval_results.jsonl"


# =========================
# LOAD EVALUATION DATA
# =========================

def load_eval_data():
    records = []

    with open(EVAL_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    return records


# =========================
# RECALL@5
# =========================

def calculate_recall_at_5(results, relevant_ids):

    retrieved_ids = {
        str(result["problem_id"])
        for result in results[:TOP_K]
    }

    relevant_ids = {
        str(x)
        for x in relevant_ids
    }

    return 1.0 if retrieved_ids.intersection(relevant_ids) else 0.0


# =========================
# MRR
# =========================

def calculate_mrr(results, relevant_ids):

    relevant_ids = {
        str(x)
        for x in relevant_ids
    }

    for rank, result in enumerate(results, start=1):

        problem_id = str(result["problem_id"])

        if problem_id in relevant_ids:
            return 1.0 / rank

    return 0.0


# =========================
# MAIN
# =========================

def main():

    # -------------------------
    # Load evaluation dataset
    # -------------------------

    eval_data = load_eval_data()

    print(f"Evaluation queries: {len(eval_data)}")
    print("Loading HybridRetriever...")

    # -------------------------
    # Load retriever ONCE
    # -------------------------

    retriever = HybridRetriever()

    print("Retriever loaded.")
    print()

    # -------------------------
    # Metric storage
    # -------------------------

    recall_scores = []
    mrr_scores = []
    latencies = []

    # Store detailed results
    evaluation_results = []

    # =========================
    # RUN EVALUATION
    # =========================

    for i, record in enumerate(eval_data, start=1):

        query = record["query"]

        relevant_ids = record["relevant_problem_ids"]

        # -------------------------
        # Measure retrieval latency
        # -------------------------

        start = time.perf_counter()

        output = retriever.retrieve(query)

        latency = (
            time.perf_counter() - start
        ) * 1000

        # -------------------------
        # Retrieved results
        # -------------------------

        results = output["results"]

        # -------------------------
        # Calculate metrics
        # -------------------------

        recall = calculate_recall_at_5(
            results,
            relevant_ids
        )

        mrr = calculate_mrr(
            results,
            relevant_ids
        )

        # -------------------------
        # Store metrics
        # -------------------------

        recall_scores.append(recall)
        mrr_scores.append(mrr)
        latencies.append(latency)

        # -------------------------
        # Save detailed result
        # -------------------------

        evaluation_results.append({
            "query": query,

            "relevant_problem_ids": relevant_ids,

            "retrieved_results": results[:TOP_K],

            "recall_at_5": recall,

            "mrr": mrr,

            "latency_ms": latency
        })

        # -------------------------
        # Progress
        # -------------------------

        if i % 50 == 0:

            print(
                f"Processed {i}/{len(eval_data)} | "
                f"Recall@5 so far: "
                f"{statistics.mean(recall_scores):.4f} | "
                f"MRR so far: "
                f"{statistics.mean(mrr_scores):.4f}"
            )

    # =========================
    # SAVE DETAILED RESULTS
    # =========================

    with open(
        RESULTS_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        for item in evaluation_results:

            f.write(
                json.dumps(
                    item,
                    ensure_ascii=False
                ) + "\n"
            )

    print()
    print(
        f"Detailed results saved to: "
        f"{RESULTS_FILE}"
    )

    # =========================
    # FINAL METRICS
    # =========================

    recall_at_5 = statistics.mean(
        recall_scores
    )

    mrr = statistics.mean(
        mrr_scores
    )

    avg_latency = statistics.mean(
        latencies
    )

    # -------------------------
    # Percentiles
    # -------------------------

    sorted_latencies = sorted(
        latencies
    )

    p50 = sorted_latencies[
        int(0.50 * len(sorted_latencies))
    ]

    p95 = sorted_latencies[
        int(0.95 * len(sorted_latencies))
    ]

    p99 = sorted_latencies[
        int(0.99 * len(sorted_latencies))
    ]

    # =========================
    # PRINT RESULTS
    # =========================

    print()
    print("=" * 60)
    print("RETRIEVAL EVALUATION RESULTS")
    print("=" * 60)

    print(
        f"Recall@5 : "
        f"{recall_at_5:.4f}"
    )

    print(
        f"MRR      : "
        f"{mrr:.4f}"
    )

    print()

    print("Latency")

    print("-" * 60)

    print(
        f"Average  : "
        f"{avg_latency:.2f} ms"
    )

    print(
        f"P50      : "
        f"{p50:.2f} ms"
    )

    print(
        f"P95      : "
        f"{p95:.2f} ms"
    )

    print(
        f"P99      : "
        f"{p99:.2f} ms"
    )

    print("=" * 60)


# =========================
# ENTRY POINT
# =========================

if __name__ == "__main__":
    main()

