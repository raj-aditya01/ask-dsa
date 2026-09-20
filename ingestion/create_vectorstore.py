import json
import os

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# -----------------------------------
# Load chunks
# -----------------------------------

input_file = os.path.join(PROJECT_ROOT, "data", "problem_chunks.json")

with open(input_file, "r", encoding="utf-8") as file:
    chunks = json.load(file)

print("Total chunks loaded:", len(chunks))


# -----------------------------------
# Load embedding model
# -----------------------------------

print("Loading embedding model...")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

print("Embedding model loaded!")


# -----------------------------------
# Create LangChain Documents
# -----------------------------------

documents = []

for chunk in chunks:
    topics = chunk.get("topics", [])

    if not isinstance(topics, list):
        topics = []

    topics_text = ", ".join(
        str(topic) for topic in topics
    )

    document = Document(
        page_content=chunk["text"],
        metadata={
            "problem_id": chunk["problem_id"],
            "title": chunk["title"],
            "difficulty": chunk["difficulty"],
            "topics": topics_text,
            "category": chunk["category"],
            "chunk_id": chunk["chunk_id"]
        }
    )

    documents.append(document)


print("Documents created:", len(documents))


# -----------------------------------
# Create ChromaDB
# -----------------------------------

print("Creating ChromaDB...")

persist_dir = os.path.join(PROJECT_ROOT, "chroma_db")

vectorstore = Chroma.from_documents(
    documents=documents,
    embedding=embeddings,
    persist_directory=persist_dir,
    collection_name="askdsa"
)


print("\nChromaDB created successfully!")
print(f"Database location: {persist_dir}")