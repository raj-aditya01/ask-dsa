import json
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
input_file = os.path.join(PROJECT_ROOT, "data", "cleaned_problems.json")

with open(input_file, "r", encoding="utf-8") as file:
    data = json.load(file)

print("Total problems:", len(data))

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

all_chunks = []

for problem in data:
    topics = problem.get("topics", [])

    # Make sure topics is always a list
    if not isinstance(topics, list):
        topics = []

    topics_text = ", ".join(
        str(topic) for topic in topics
    )

    text = f"""
Problem ID: {problem['problem_id']}

Title: {problem['title']}

Difficulty: {problem['difficulty']}

Topics: {topics_text}

Category: {problem['category']}

Description:
{problem['description']}
"""

    chunks = text_splitter.split_text(text)

    for i, chunk in enumerate(chunks):
        chunk_data = {
            "problem_id": problem["problem_id"],
            "title": problem["title"],
            "difficulty": problem["difficulty"],
            "topics": topics,
            "category": problem["category"],
            "chunk_id": i,
            "text": chunk
        }

        all_chunks.append(chunk_data)


output_file = os.path.join(PROJECT_ROOT, "data", "problem_chunks.json")

with open(output_file, "w", encoding="utf-8") as file:
    json.dump(
        all_chunks,
        file,
        indent=2,
        ensure_ascii=False
    )

print("Total chunks:", len(all_chunks))
print("Saved to:", output_file)

print("\nFirst chunk:")
print(json.dumps(all_chunks[0], indent=2, ensure_ascii=False))