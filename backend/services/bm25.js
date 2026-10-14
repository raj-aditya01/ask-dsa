/**
 * High-Performance BM25Okapi Implementation in Node.js
 * Matches rank_bm25 parameters (k1=1.5, b=0.75, epsilon=0.25)
 */

function tokenize(text) {
  if (!text) return [];
  const matches = String(text).toLowerCase().match(/[a-z0-9]+/g);
  return matches || [];
}

class BM25Okapi {
  constructor(corpusTokens, k1 = 1.5, b = 0.75, epsilon = 0.25) {
    this.k1 = k1;
    this.b = b;
    this.epsilon = epsilon;
    this.corpusSize = corpusTokens.length;
    this.docLengths = new Float64Array(this.corpusSize);
    this.docFrequencies = new Map(); // term -> count of docs
    this.docTermFreqs = []; // array of Maps (term -> count)

    let totalLength = 0;

    for (let i = 0; i < this.corpusSize; i++) {
      const tokens = corpusTokens[i];
      const length = tokens.length;
      this.docLengths[i] = length;
      totalLength += length;

      const termFreq = new Map();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }
      this.docTermFreqs.push(termFreq);

      for (const term of termFreq.keys()) {
        this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
      }
    }

    this.avgdl = this.corpusSize > 0 ? totalLength / this.corpusSize : 0;
    this.idf = new Map();
    this._calcIdf();
  }

  _calcIdf() {
    let idfSum = 0;
    const negativeIdfs = [];

    for (const [term, freq] of this.docFrequencies.entries()) {
      // standard rank_bm25 idf: math.log((N - n + 0.5) / (n + 0.5) + 1)
      const idfVal = Math.log((this.corpusSize - freq + 0.5) / (freq + 0.5) + 1.0);
      this.idf.set(term, idfVal);
      idfSum += idfVal;
      if (idfVal < 0) {
        negativeIdfs.push(term);
      }
    }

    const averageIdf = this.docFrequencies.size > 0 ? idfSum / this.docFrequencies.size : 0;
    const epsFloor = this.epsilon * averageIdf;

    for (const term of negativeIdfs) {
      this.idf.set(term, epsFloor);
    }
  }

  getScores(queryTokens) {
    const scores = new Float64Array(this.corpusSize);
    if (!queryTokens || queryTokens.length === 0 || this.corpusSize === 0) {
      return scores;
    }

    // Filter to terms present in IDF map
    const uniqueQueryTerms = [...new Set(queryTokens)];

    for (const term of uniqueQueryTerms) {
      const idfVal = this.idf.get(term);
      if (idfVal === undefined) continue;

      for (let i = 0; i < this.corpusSize; i++) {
        const tf = this.docTermFreqs[i].get(term) || 0;
        if (tf === 0) continue;

        const docLen = this.docLengths[i];
        const denom = tf + this.k1 * (1.0 - this.b + this.b * (docLen / this.avgdl));
        const score = (idfVal * tf * (this.k1 + 1.0)) / denom;
        scores[i] += score;
      }
    }

    return scores;
  }
}

module.exports = {
  tokenize,
  BM25Okapi,
};
