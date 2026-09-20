import os
import sys
from dotenv import load_dotenv

# Ensure UTF-8 output encoding for Windows terminal
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from retrieval.hybrid_retriever import HybridRetriever
from retrieval.generator import DSAGenerator, create_groq_llm

load_dotenv()

query = "How to detect a cycle in a linked list?"

# 1. Retrieve relevant documents
print("\n[1/3] Retrieving relevant documents...")
retriever = HybridRetriever()
response = retriever.retrieve(query)
results = response["results"]

print("\nRetrieved documents:")
for result in results:
    print(f"  [{result.get('problem_id', '?')}] {result.get('title', 'Unknown')} ({result.get('difficulty', '')})")

# 2. Check API Key and Generate Answer
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("\n[!] GROQ_API_KEY is not set in your .env file.")
    print("--> Please add your Groq API key in .env:")
    print("    GROQ_API_KEY=gsk_your_key_here\n")
else:
    print("\n[2/3] Initializing Groq LLM...")
    llm = create_groq_llm()
    generator = DSAGenerator(llm=llm)

    print("\n[3/3] Generating answer...")
    print("\n================ LLM ANSWER ================\n")
    answer = generator.generate(query, results)
    print(answer)