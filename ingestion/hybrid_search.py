import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )
)

from retrieval.display import print_results
from retrieval.hybrid_retriever import HybridRetriever


if __name__ == "__main__":
    query = input("\nEnter your DSA question: ")
    retriever = HybridRetriever()
    response = retriever.retrieve(query)
    print_results(response)
