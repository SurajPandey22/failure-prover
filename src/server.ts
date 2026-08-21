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

import * as fs from 'fs';
import * as path from 'path';

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/examples', (req, res) => {
  try {
    const examplesDir = path.join(__dirname, '../examples');
    const dirs = fs.readdirSync(examplesDir).filter(f => fs.statSync(path.join(examplesDir, f)).isDirectory());
    
    const examples = dirs.map(d => {
      const logPath = path.join(examplesDir, d, 'failure.log');
      let logContent = '';
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, 'utf-8');
      }
      return {
        name: d,
        path: `./examples/${d}`,
        log: logContent
      };
    });
    res.json(examples);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

import { execSync } from 'child_process';
import { FakeLLM } from './llm';

app.post('/apply-patch', async (req, res) => {
  const { repoPath, patch } = req.body;
  if (!repoPath || !patch) {
    return res.status(400).json({ error: 'Missing repoPath or patch' });
  }

  try {
    const patchFile = path.join(repoPath, '_temp_fix.patch');
    fs.writeFileSync(patchFile, patch);
    
    try {
      execSync('git apply _temp_fix.patch', { cwd: repoPath });
      if (fs.existsSync(patchFile)) fs.unlinkSync(patchFile);
      return res.json({ success: true, message: 'Git patch applied cleanly to target repository!' });
    } catch (gitErr: any) {
      if (fs.existsSync(patchFile)) fs.unlinkSync(patchFile);
      return res.status(500).json({ error: `Git apply failed: ${gitErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/investigate-stream', async (req, res) => {
  const { log, repoPath, demoMode } = req.body;
  if (!log || !repoPath) {
    return res.status(400).json({ error: 'Missing log or repoPath' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onProgress = (msg: string) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`);
  };

  try {
    const context = Parser.parse(log);
    let llm: any;

    if (demoMode) {
      const fake = new FakeLLM();
      fake.responses = [
        JSON.stringify([
          {
            statement: "Unsafe type conversion in header parser on non-numeric value 'AUTO'",
            likelySourceLocation: "parser.py:8",
            reasoning: "Traceback points to int(parts[2]) crashing with ValueError on 'AUTO'",
            proposedExperiment: "read file parser.py"
          },
          {
            statement: "Missing input boundary validation for variable column counts in CSV line",
            likelySourceLocation: "parser.py:5",
            reasoning: "Parser assumes strict 3-part structure without lenient handling",
            proposedExperiment: "read file parser.py"
          }
        ]),
        "read file parser.py",
        JSON.stringify({ supports: true, contradicts: false, reason: "Line 8 directly calls int(parts[2]) without fallback" }),
        JSON.stringify({ status: "SUPPORTED" }),
        `--- a/parser.py
+++ b/parser.py
@@ -5,4 +5,4 @@ def parse_header(header_line: str):
         raise ValueError("Invalid header format")
     
     # Bug: assumes age is always an integer, but it can be "AUTO" in some files
-    age = int(parts[2])
+    age = "AUTO" if parts[2] == "AUTO" else int(parts[2])`
      ];
      llm = fake;
    } else {
      llm = new GeminiLLM();
    }

    const runner = new ExperimentRunner(repoPath);
    const ledger = new Ledger();
    
    const loop = new InvestigationLoop(llm, runner, ledger, onProgress);
    const diagnosis = await loop.run(context);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      diagnosis, 
      hypotheses: ledger.getAllHypotheses(), 
      evidence: ledger.getAllEvidence() 
    })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Failure Prover API running on port ${PORT}`);
});
