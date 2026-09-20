import json
import random
from pathlib import Path


# =========================
# CONFIG
# =========================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "data" / "problem_chunks.json"
OUTPUT_FILE = PROJECT_ROOT / "evaluation" / "data" / "synthetic_eval.jsonl"

NUM_PROBLEMS = 100
RANDOM_SEED = 42


# =========================
# LOAD DATA
# =========================

def load_problems():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    problems = {}

    for chunk in chunks:
        problem_id = str(chunk["problem_id"])

        if problem_id not in problems:
            problems[problem_id] = {
                "problem_id": problem_id,
                "title": chunk["title"],
                "difficulty": chunk.get("difficulty", ""),
                "topics": chunk.get("topics", []),
                "category": chunk.get("category", ""),
                "text": chunk.get("text", ""),
            }

    return list(problems.values())


# =========================
# QUERY GENERATION
# =========================

def generate_queries(problem):
    title = problem["title"]
    topics = problem["topics"]

    topic_text = ", ".join(topics) if topics else "DSA"

    queries = [
        {
            "query_type": "direct",
            "query": f"Explain the {title} problem."
        },
        {
            "query_type": "paraphrase",
            "query": f"How can I solve the problem of {title.lower()}?"
        },
        {
            "query_type": "conceptual",
            "query": (
                f"I want to understand the main idea and algorithm "
                f"used for {title.lower()}."
            )
        },
        {
            "query_type": "topic_based",
            "query": (
                f"Can you show me a {topic_text} problem related to "
                f"{title.lower()} and explain how to approach it?"
            )
        },
        {
            "query_type": "interview",
            "query": (
                f"How would you explain the solution for {title} "
                f"in a technical interview?"
            )
        },
    ]

    return queries


# =========================
# MAIN
# =========================

def main():

    random.seed(RANDOM_SEED)

    problems = load_problems()

    print(f"Total unique problems: {len(problems)}")

    if len(problems) < NUM_PROBLEMS:
        selected = problems
    else:
        selected = random.sample(problems, NUM_PROBLEMS)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    total_queries = 0

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:

        for problem in selected:

            queries = generate_queries(problem)

            for item in queries:

                record = {
                    "query": item["query"],
                    "query_type": item["query_type"],
                    "relevant_problem_ids": [
                        str(problem["problem_id"])
                    ],
                    "difficulty": problem["difficulty"],
                    "source_title": problem["title"],
                }

                f.write(
                    json.dumps(
                        record,
                        ensure_ascii=False
                    )
                    + "\n"
                )

                total_queries += 1

    print()
    print("Evaluation dataset generated successfully!")
    print(f"Problems used: {len(selected)}")
    print(f"Queries generated: {total_queries}")
    print(f"Output file: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()