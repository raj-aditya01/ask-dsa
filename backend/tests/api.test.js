const request = require('supertest');
const { app } = require('../server');
const { getRetriever } = require('../services/hybridRetriever');

beforeAll(async () => {
  // Pre-load retriever chunks
  getRetriever();
});

describe('Express API Endpoints', () => {
  test('GET / returns API summary with metadata headers', async () => {
    const res = await request(app).get('/').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('version');
    expect(res.body.docs).toBe('/docs');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-process-time']).toBeDefined();
  });

  test('GET /api/v1/health returns healthy system status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.retrieval_ready).toBe(true);
    expect(res.body).toHaveProperty('llm_ready');
    expect(res.body).toHaveProperty('model');
  });

  test('POST /api/v1/retrieve returns 422 for query with less than 2 chars', async () => {
    const res = await request(app)
      .post('/api/v1/retrieve')
      .send({ query: 'x' });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/retrieve successfully retrieves Two Sum problem', async () => {
    const res = await request(app)
      .post('/api/v1/retrieve')
      .send({ query: 'Two Sum', top_k: 3 });
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('Two Sum');
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].problem_id).toBe('1');
    expect(res.body.metrics.retrieval_ms).toBeDefined();
  });

  test('GET /dashboard serves dashboard HTML', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('ASK-DSA');
  });

  test('GET /api/v1/ask/stream returns SSE stream for valid query', async () => {
    const res = await request(app)
      .get('/api/v1/ask/stream?query=Two%20Sum&top_k=2')
      .set('Accept', 'text/event-stream');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('data:');
    expect(res.text).toContain('"type":"metadata"');
  });
});
