import sys
import argparse

# Ensure UTF-8 output encoding for Windows terminal
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from retrieval.hybrid_retriever import get_retriever
from retrieval.generator import DSAGenerator, create_groq_llm
from retrieval.display import print_results


def run_query(query: str, retriever, generator, show_sources: bool = True):
    print(f"\n[1/2] Searching & Reranking: '{query}'...")
    response = retriever.retrieve(query)
    results = response.get("results", [])

    if show_sources:
        print_results(response)

    print("\n[2/2] Generating Answer from ASK-DSA...")
    print("=" * 60)
    for chunk in generator.stream(query, results=results):
        print(chunk, end="", flush=True)
    print("\n" + "=" * 60 + "\n")


def interactive_mode():
    print("=" * 60)
    print(" ASK-DSA: Interactive Terminal Assistant")
    print(" Type your DSA question below.")
    print(" Commands: 'exit' or 'quit' to close, 'clear' to reset.")
    print("=" * 60)

    print("\nLoading retrieval engine and Groq LLM...")
    retriever = get_retriever()
    llm = create_groq_llm()
    generator = DSAGenerator(llm=llm)
    print("Ready!\n")

    while True:
        try:
            query = input("ASK-DSA > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting ASK-DSA. Goodbye!")
            break

        if not query:
            continue
        if query.lower() in ("exit", "quit", "q"):
            print("Exiting ASK-DSA. Goodbye!")
            break
        if query.lower() == "clear":
            print("\033[H\033[J", end="")
            continue

        try:
            run_query(query, retriever, generator)
        except Exception as e:
            print(f"\n[Error processing query]: {e}\n")


def main():
    parser = argparse.ArgumentParser(description="ASK-DSA Terminal Interface")
    parser.add_argument(
        "query",
        nargs="*",
        help="Optional DSA question to ask directly from terminal. If omitted, starts interactive mode.",
    )
    parser.add_argument(
        "--no-sources",
        action="store_true",
        help="Hide retrieved document details and only show the final answer.",
    )

    args = parser.parse_args()

    if args.query:
        full_query = " ".join(args.query)
        retriever = get_retriever()
        llm = create_groq_llm()
        generator = DSAGenerator(llm=llm)
        run_query(full_query, retriever, generator, show_sources=not args.no_sources)
    else:
        interactive_mode()


if __name__ == "__main__":
    main()
