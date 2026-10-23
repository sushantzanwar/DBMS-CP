import 'dotenv/config';
import express from 'express';
import { api } from './api.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', api);

// Any unknown address, and malformed JSON, get a plain JSON answer.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, req, res, next) => res.status(400).json({ error: 'Invalid request.' }));

const port = Number(process.env.API_PORT) || 4000;
app.listen(port, () => console.log(`ServicePath API listening on http://localhost:${port}`));
