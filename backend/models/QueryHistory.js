const mongoose = require('mongoose');

const QueryHistorySchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
    },
    cleanedQuery: {
      type: String,
    },
    strategy: {
      type: String,
      default: 'specific_qa',
    },
    topic: {
      type: String,
    },
    difficulty: {
      type: String,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
    topResults: [
      {
        problem_id: String,
        title: String,
        difficulty: String,
        score: Number,
        rerank_score: Number,
      },
    ],
    answer: {
      type: String,
    },
    metrics: {
      retrieval_ms: Number,
      generation_ms: Number,
      total_ms: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('QueryHistory', QueryHistorySchema);
