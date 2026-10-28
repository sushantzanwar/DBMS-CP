import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { api } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Enable CORS so frontend works whether hosted on the same origin or across different domains
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// API routes
app.use('/api', api);

// 404 handler for unmatched /api routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// In production, serve the compiled frontend from ../frontend/dist
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Not found.' });
  });
});

app.use((error, req, res, next) => res.status(400).json({ error: 'Invalid request.' }));

const port = Number(process.env.PORT) || Number(process.env.API_PORT) || 4000;
app.listen(port, () => console.log(`ServicePath API listening on http://localhost:${port}`));
