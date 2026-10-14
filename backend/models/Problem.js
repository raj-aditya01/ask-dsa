const mongoose = require('mongoose');

const ProblemSchema = new mongoose.Schema(
  {
    problem_id: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Unknown'],
      default: 'Unknown',
      index: true,
    },
    topics: {
      type: [String],
      default: [],
      index: true,
    },
    category: {
      type: String,
      default: 'Algorithms',
    },
    chunk_id: {
      type: Number,
      default: 0,
    },
    text: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for potential MongoDB full-text searches
ProblemSchema.index({ title: 'text', text: 'text' });

module.exports = mongoose.model('Problem', ProblemSchema);
