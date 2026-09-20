import json
import os
import re
from typing import Any

import numpy as np
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from rank_bm25 import BM25Okapi

from retrieval.adaptive_rag import classify_query


PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)
CHUNKS_PATH = os.path.join(PROJECT_ROOT, "data", "problem_chunks.json")
CHROMA_PATH = os.path.join(PROJECT_ROOT, "chroma_db")
COLLECTION_NAME = "askdsa"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def _build_topic_index(chunks):
    topic_index = {}

    for chunk in chunks:
        problem_id = chunk["problem_id"]
        topics = chunk.get("topics") or []

        if not isinstance(topics, list):
            continue

        for topic in topics:
            topic_index.setdefault(topic, set()).add(problem_id)

    return topic_index


class HybridRetriever:
    def __init__(self):
        with open(CHUNKS_PATH, "r", encoding="utf-8") as file:
            self.chunks = json.load(file)

        self.topic_index = _build_topic_index(self.chunks)
        self.chunk_lookup = {
            (chunk["problem_id"], chunk["chunk_id"]): chunk
            for chunk in self.chunks
        }

        self.embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL
        )

        self.vectorstore = Chroma(
            persist_directory=CHROMA_PATH,
            collection_name=COLLECTION_NAME,
            embedding_function=self.embeddings,
        )

        corpus_tokens = [_tokenize(chunk["text"]) for chunk in self.chunks]
        self.bm25 = BM25Okapi(corpus_tokens)

    def _metadata_filter(self, topic, difficulty):
        filters = {}

        if difficulty:
            filters["difficulty"] = difficulty

        if topic:
            filters["topics"] = {"$contains": topic}

        if not filters:
            return None

        if len(filters) == 1:
            return filters

        return {"$and": [{key: value} for key, value in filters.items()]}

    def _dense_search(self, query, candidate_k, metadata_filter):
        kwargs = {"k": candidate_k}

        if metadata_filter:
            kwargs["filter"] = metadata_filter

        return self.vectorstore.similarity_search_with_score(
            query,
            **kwargs,
        )

    def _bm25_search(self, query, candidate_k, allowed_problem_ids=None):
        query_tokens = _tokenize(query)

        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        ranked_indexes = np.argsort(scores)[::-1]

        results = []

        for index in ranked_indexes:
            if scores[index] <= 0:
                break

            chunk = self.chunks[index]

            if (
                allowed_problem_ids is not None
                and chunk["problem_id"] not in allowed_problem_ids
            ):
                continue

            results.append((index, float(scores[index])))

            if len(results) >= candidate_k:
                break

        return results

    @staticmethod
    def _reciprocal_rank_fusion(ranked_lists, k=60, weights=None):
        scores = {}
        payloads = {}

        if weights is None:
            weights = [1.0] * len(ranked_lists)

        for weight, ranked_list in zip(weights, ranked_lists):
            for rank, (key, payload, _) in enumerate(ranked_list, start=1):
                scores[key] = scores.get(key, 0.0) + weight / (k + rank)
                payloads[key] = payload

        return sorted(
            scores.items(),
            key=lambda item: item[1],
            reverse=True,
        ), payloads

    def _apply_mmr(self, query, ranked_items, payloads, top_k, lambda_param=0.7):
        if not ranked_items:
            return []

        query_embedding = np.array(
            self.embeddings.embed_query(query),
            dtype=float,
        )

        selected = []
        remaining = list(ranked_items)

        while remaining and len(selected) < top_k:
            best_idx = None
            best_score = None

            for idx, (problem_id, rrf_score) in enumerate(remaining):
                chunk = payloads[problem_id]
                text = chunk["text"] if isinstance(chunk, dict) else chunk.page_content
                doc_embedding = np.array(
                    self.embeddings.embed_query(text[:1000]),
                    dtype=float,
                )

                relevance = float(
                    np.dot(query_embedding, doc_embedding)
                    / (
                        np.linalg.norm(query_embedding)
                        * np.linalg.norm(doc_embedding)
                        + 1e-8
                    )
                )

                diversity = 0.0
                if selected:
                    selected_embeddings = [
                        np.array(
                            self.embeddings.embed_query(
                                (
                                    payloads[item_id]["text"]
                                    if isinstance(payloads[item_id], dict)
                                    else payloads[item_id].page_content
                                )[:1000]
                            ),
                            dtype=float,
                        )
                        for item_id, _ in selected
                    ]
                    diversity = max(
                        float(
                            np.dot(doc_embedding, other)
                            / (
                                np.linalg.norm(doc_embedding)
                                * np.linalg.norm(other)
                                + 1e-8
                            )
                        )
                        for other in selected_embeddings
                    )

                mmr_score = lambda_param * relevance - (1 - lambda_param) * diversity

                if best_score is None or mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            selected.append(remaining.pop(best_idx))

        return selected

    def _dedupe_by_problem(self, ranked_items, payloads, top_k):
        seen = set()
        final = []

        for problem_id, score in ranked_items:
            if problem_id in seen:
                continue

            seen.add(problem_id)
            final.append(
                {
                    "problem_id": problem_id,
                    "score": score,
                    "payload": payloads[problem_id],
                }
            )

            if len(final) >= top_k:
                break

        return final

    def _format_result(self, item):
        payload = item["payload"]

        if isinstance(payload, dict):
            return {
                "problem_id": item["problem_id"],
                "title": payload["title"],
                "difficulty": payload["difficulty"],
                "category": payload["category"],
                "topics": payload.get("topics", []),
                "text": payload["text"],
                "score": item["score"],
            }

        return {
            "problem_id": item["problem_id"],
            "title": payload.metadata["title"],
            "difficulty": payload.metadata["difficulty"],
            "category": payload.metadata["category"],
            "topics": payload.metadata.get("topics", ""),
            "text": payload.page_content,
            "score": item["score"],
        }

    def retrieve(self, query):
        routing = classify_query(query)
        dense_query = routing["modified_query"]
        bm25_query = routing["original_query"]

        if routing["topic"]:
            bm25_query = f"{bm25_query} {routing['topic']}"

        topic = routing["topic"]
        difficulty = routing["difficulty"]
        candidate_k = routing["candidate_k"]
        top_k = routing["top_k"]

        allowed_problem_ids = None
        if topic and topic in self.topic_index:
            allowed_problem_ids = self.topic_index[topic]

        metadata_filter = self._metadata_filter(topic, difficulty)

        dense_hits = self._dense_search(
            dense_query,
            candidate_k=candidate_k,
            metadata_filter=metadata_filter,
        )

        dense_ranked = []
        for document, score in dense_hits:
            problem_id = document.metadata["problem_id"]

            if (
                allowed_problem_ids is not None
                and problem_id not in allowed_problem_ids
            ):
                continue

            dense_ranked.append(
                (problem_id, document, float(score))
            )

        ranked_lists = [dense_ranked]

        rrf_weights = [1.5]

        if routing["use_hybrid"]:
            bm25_hits = self._bm25_search(
                bm25_query,
                candidate_k=candidate_k,
                allowed_problem_ids=allowed_problem_ids,
            )

            bm25_ranked = [
                (
                    self.chunks[index]["problem_id"],
                    self.chunks[index],
                    score,
                )
                for index, score in bm25_hits
            ]
            ranked_lists.append(bm25_ranked)
            rrf_weights.append(1.0)

            expansion_query = routing.get("expansion_query")
            if expansion_query:
                expansion_hits = self._bm25_search(
                    expansion_query,
                    candidate_k=candidate_k,
                    allowed_problem_ids=allowed_problem_ids,
                )
                expansion_ranked = [
                    (
                        self.chunks[index]["problem_id"],
                        self.chunks[index],
                        score,
                    )
                    for index, score in expansion_hits
                ]
                ranked_lists.append(expansion_ranked)
                rrf_weights.append(1.2)

        ranked_items, payloads = self._reciprocal_rank_fusion(
            ranked_lists,
            weights=rrf_weights,
        )

        if routing["use_mmr"]:
            ranked_items = self._apply_mmr(
                dense_query,
                ranked_items,
                payloads,
                top_k=top_k,
            )
        else:
            ranked_items = ranked_items[: candidate_k]

        final_results = self._dedupe_by_problem(
            ranked_items,
            payloads,
            top_k=top_k,
        )

        return {
            "routing": routing,
            "results": [self._format_result(item) for item in final_results],
        }


def retrieve(query):
    retriever = HybridRetriever()
    return retriever.retrieve(query)
