import json
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
file_path = os.path.join(PROJECT_ROOT, "data", "leetcode_problems.json")

with open(file_path, "r", encoding="utf-8") as file:
    data = json.load(file)

print("Type:", type(data))
print("Number of problems:", len(data))

print("\nFirst problem:")
print(data[0])