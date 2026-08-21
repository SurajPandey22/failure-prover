import express from 'express';
import cors from 'cors';
import { Parser } from './parser';
import { GeminiLLM } from './llm';
import { ExperimentRunner } from './execution';
import { Ledger } from './ledger';
import { InvestigationLoop } from './loop';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/investigate', async (req, res) => {
  const { log, repoPath } = req.body;
  if (!log || !repoPath) {
    return res.status(400).json({ error: 'Missing log or repoPath' });
  }

  try {
    const context = Parser.parse(log);
    const llm = new GeminiLLM();
    const runner = new ExperimentRunner(repoPath);
    const ledger = new Ledger();
    const loop = new InvestigationLoop(llm, runner, ledger);

    const diagnosis = await loop.run(context);
    
    res.json({
      diagnosis,
      hypotheses: ledger.getAllHypotheses(),
      evidence: ledger.getAllEvidence()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Failure Prover API running on port ${PORT}`);
});
