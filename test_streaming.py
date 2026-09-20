import sys

# Ensure UTF-8 output encoding for Windows terminal
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from retrieval.hybrid_retriever import HybridRetriever
from retrieval.generator import DSAGenerator, create_groq_llm


query = "How to detect a cycle in a linked list?"


print("\n[1/3] Retrieving relevant documents...")

retriever = HybridRetriever()

response = retriever.retrieve(query)

results = response["results"]


print("\nRetrieved documents:")

for result in results:
    print(
        f"  [{result['problem_id']}] {result['title']}"
    )


print("\n[2/3] Initializing Groq LLM...")

llm = create_groq_llm()

generator = DSAGenerator(llm)


print("\n[3/3] Streaming answer...")
print("\n================ STREAMING ANSWER ================\n")


for chunk in generator.stream(query, results):
    print(chunk, end="", flush=True)


print("\n\n================ STREAMING COMPLETE ================")