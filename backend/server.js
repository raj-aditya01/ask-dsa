const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('crypto').randomUUID
  ? { v4: require('crypto').randomUUID }
  : { v4: () => Math.random().toString(36).substring(2) };

const config = require('./config/config');
const { connectDB } = require('./config/db');
const { getRetriever } = require('./services/hybridRetriever');

// Import routes
const healthRoutes = require('./routes/health');
const retrievalRoutes = require('./routes/retrieval');
const chatRoutes = require('./routes/chat');

const app = express();

// 1. Process timing & Request ID middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  const requestId = uuidv4();
  res.setHeader('X-Request-ID', requestId);

  const originalSend = res.send;
  res.send = function (...args) {
    if (!res.headersSent) {
      const diff = process.hrtime(start);
      const timeMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
      res.setHeader('X-Process-Time', `${timeMs}ms`);
    }
    return originalSend.apply(this, args);
  };

  next();
});

// 2. CORS configuration
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 4. Rate Limiters
const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_DEFAULT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_GENERATE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many generation requests, please try again later.',
    },
  },
});

// 5. API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/retrieve', defaultLimiter, retrievalRoutes);
app.use('/api/v1/ask', generateLimiter, chatRoutes);

// Static assets directory
const frontendDist = path.resolve(__dirname, '../frontend/dist');
const legacyStatic = path.resolve(__dirname, '../app/static');

app.use('/static', express.static(legacyStatic, { index: false }));
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
}

// Root and Dashboard handlers
const serveDashboardHtml = (res) => {
  const indexPath = fs.existsSync(path.join(frontendDist, 'index.html'))
    ? path.join(frontendDist, 'index.html')
    : path.join(legacyStatic, 'index.html');

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(200).send('<h1>ASK-DSA MERN API Server Running</h1>');
};

app.get('/dashboard', (req, res) => {
  serveDashboardHtml(res);
});

app.get('/', (req, res) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return serveDashboardHtml(res);
  }

  return res.status(200).json({
    name: config.APP_NAME,
    version: config.APP_VERSION,
    description: config.APP_DESCRIPTION,
    docs: '/docs',
    status: 'online',
    groq_model: config.GROQ_MODEL,
  });
});

// Interactive API Documentation endpoint
app.get('/docs', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>ASK-DSA API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" >
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      dom_id: '#swagger-ui',
      spec: {
        openapi: "3.0.0",
        info: {
          title: "ASK-DSA API (MERN)",
          version: "1.0.0",
          description: "Enterprise DSA Tutoring & Problem Retrieval Engine API"
        },
        paths: {
          "/api/v1/health": {
            get: {
              summary: "Health Check",
              responses: { 200: { description: "System health status" } }
            }
          },
          "/api/v1/retrieve": {
            post: {
              summary: "Retrieve relevant DSA problems",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        query: { type: "string", example: "Two Sum" },
                        top_k: { type: "integer", example: 5 }
                      },
                      required: ["query"]
                    }
                  }
                }
              },
              responses: { 200: { description: "Ranked matching problem documents" } }
            }
          },
          "/api/v1/ask": {
            post: {
              summary: "Synchronous DSA Question Solution",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        query: { type: "string", example: "How to detect a cycle in a linked list?" },
                        top_k: { type: "integer", example: 5 }
                      },
                      required: ["query"]
                    }
                  }
                }
              },
              responses: { 200: { description: "Grounded solution and complexity analysis" } }
            }
          },
          "/api/v1/ask/stream": {
            post: {
              summary: "Stream solution tokens via Server-Sent Events (SSE)",
              responses: { 200: { description: "SSE stream of metadata, tokens, and done event" } }
            }
          }
        }
      }
    });
  </script>
</body>
</html>
  `);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

let serverInstance = null;

async function startServer(port = config.PORT) {
  // Connect DB
  await connectDB();

  // Pre-warm retriever
  console.log('[ASK-DSA] Pre-warming HybridRetriever index...');
  getRetriever();

  return new Promise((resolve) => {
    serverInstance = app.listen(port, () => {
      console.log(`[ASK-DSA Server] Running on http://localhost:${port}`);
      console.log(`[ASK-DSA Docs] Swagger UI at http://localhost:${port}/docs`);
      resolve(serverInstance);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
