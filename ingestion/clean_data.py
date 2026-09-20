import json
import os
from bs4 import BeautifulSoup

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 1. Load raw dataset
input_file = os.path.join(PROJECT_ROOT, "data", "leetcode_problems.json")

with open(input_file, "r", encoding="utf-8") as file:
    data = json.load(file)

print("Total raw problems:", len(data))


# 2. Function to clean HTML
def clean_html(text):
    if not text:
        return ""

    soup = BeautifulSoup(text, "html.parser")

    # Remove unnecessary HTML elements
    for tag in soup(["script", "style", "img"]):
        tag.decompose()

    text = soup.get_text(" ", strip=True)

    return text


# 3. Clean and structure data
cleaned_data = []

for problem in data:
    description = clean_html(
        problem.get("description", "")
    )

    cleaned_problem = {
        "problem_id": str(
            problem.get("frontendQuestionId", "")
        ).strip(),
        "title": str(
            problem.get("title", "")
        ).strip(),
        "difficulty": str(
            problem.get("difficulty", "")
        ).strip(),
        "description": description,
        "category": str(
            problem.get("category", "")
        ).strip(),
        "topics": problem.get("topics", []),
        "url": str(
            problem.get("url", "")
        ).strip(),
    }

    # Keep only useful problems
    if (
        cleaned_problem["title"]
        and cleaned_problem["description"]
    ):
        cleaned_data.append(cleaned_problem)


# 4. Save cleaned data
output_file = os.path.join(PROJECT_ROOT, "data", "cleaned_problems.json")

with open(
    output_file,
    "w",
    encoding="utf-8"
) as file:
    json.dump(
        cleaned_data,
        file,
        indent=2,
        ensure_ascii=False
    )


print("Cleaned problems:", len(cleaned_data))
print("Saved to:", output_file)


# 5. Show example
print("\nFirst cleaned problem:")
print(
    json.dumps(
        cleaned_data[0],
        indent=2,
        ensure_ascii=False
    )
)