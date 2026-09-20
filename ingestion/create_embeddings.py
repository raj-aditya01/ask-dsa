import json
import os
from langchain_huggingface import HuggingFaceEmbeddings

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 1. Load chunks
input_file = os.path.join(PROJECT_ROOT, "data", "problem_chunks.json")

with open(input_file, "r", encoding="utf-8") as file:
    chunks = json.load(file)

print("Total chunks loaded:", len(chunks))


# 2. Create embedding model
print("Loading embedding model...")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

print("Embedding model loaded successfully!")


# 3. Test one embedding
test_text = chunks[0]["text"]

vector = embeddings.embed_query(test_text)

print("Embedding created successfully!")
print("Vector dimensions:", len(vector))
print("First 5 values:", vector[:5])