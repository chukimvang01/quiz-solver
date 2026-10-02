import express from 'express';
import { ask } from './kiro-adapter.js';

const app = express();
app.use(express.json({ limit: '50kb' }));

// CORS cho Chrome Extension
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/ask', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'missing text' });

  try {
    const answer = await ask(text);
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(3847, '127.0.0.1', () => {
  console.log('Bridge ready → http://127.0.0.1:3847');
});
