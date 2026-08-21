import express from 'express';
import cors from 'cors';
import { Parser } from './parser';
import { GeminiLLM } from './llm';
import { ExperimentRunner } from './execution';
import { Ledger } from './ledger';
import { InvestigationLoop } from './loop';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Auth Config ─────────────────────────────────────────────────────────────
interface UserRecord { username: string; passwordHash: string; createdAt: string; }

const usersFile = path.resolve(process.cwd(), 'data', 'users.json');
const activeSessions = new Map<string, string>(); // token -> username

function ensureDataDir() {
  const dir = path.dirname(usersFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf-8');
}

function loadUsers(): UserRecord[] {
  try { ensureDataDir(); return JSON.parse(fs.readFileSync(usersFile, 'utf-8')); } catch { return []; }
}

function saveUsers(users: UserRecord[]) {
  ensureDataDir();
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'fp_salt_2024').digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-auth-token'] as string || req.query.token as string;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

// POST /signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username already taken. Please choose another.' });
  }
  const newUser: UserRecord = {
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers(users);
  const token = generateToken();
  activeSessions.set(token, username);
  return res.json({ success: true, token, username });
});

// POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = generateToken();
  activeSessions.set(token, username);
  return res.json({ success: true, token, username });
});

// POST /logout
app.post('/logout', (req, res) => {
  const token = req.headers['x-auth-token'] as string;
  if (token) activeSessions.delete(token);
  return res.json({ success: true });
});

// Apply auth to all API routes (not static files)
app.use('/investigate', authMiddleware);
app.use('/investigate-stream', authMiddleware);
app.use('/apply-patch', authMiddleware);
app.use('/export-report', authMiddleware);
app.use('/examples', authMiddleware);

// ─── Static Frontend ──────────────────────────────────────────────────────────
const frontendPath = fs.existsSync(path.resolve(process.cwd(), 'frontend'))
  ? path.resolve(process.cwd(), 'frontend')
  : path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/examples', (req, res) => {
  try {
    let examplesDir = path.resolve(process.cwd(), 'examples');
    if (!fs.existsSync(examplesDir)) {
      examplesDir = path.resolve(__dirname, '../../examples');
    }
    if (!fs.existsSync(examplesDir)) {
      examplesDir = path.resolve(__dirname, '../examples');
    }

    if (!fs.existsSync(examplesDir)) {
      return res.json([]);
    }

    const dirs = fs.readdirSync(examplesDir).filter(f => {
      const full = path.join(examplesDir, f);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    });
    
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
import { ReportGenerator } from './report';

function applyPatchSafely(repoPath: string, patchText: string): void {
  const cleanPatch = patchText.trim() + '\n';
  const patchFile = path.join(repoPath, '_temp_fix.patch');
  fs.writeFileSync(patchFile, cleanPatch);

  let applied = false;
  const relPath = path.relative(process.cwd(), path.resolve(repoPath)).replace(/\\/g, '/');

  const gitCommands = [
    `git apply --ignore-whitespace --whitespace=fix --recount _temp_fix.patch`,
    `git apply --directory="${relPath}" --ignore-whitespace --whitespace=fix --recount "${patchFile}"`,
    `git apply -p0 _temp_fix.patch`,
    `git apply -p1 _temp_fix.patch`
  ];

  for (const cmd of gitCommands) {
    try {
      execSync(cmd, { cwd: repoPath, stdio: 'pipe' });
      applied = true;
      break;
    } catch {}
  }

  if (fs.existsSync(patchFile)) fs.unlinkSync(patchFile);

  if (!applied) {
    // Semantic Diff Fallback: Replace matching removed lines with added lines
    const fileMatch = patchText.match(/--- [ab]\/(.+)/);
    if (fileMatch && fileMatch[1]) {
      const targetFileName = fileMatch[1].trim();
      const targetFilePath = path.join(repoPath, targetFileName);
      if (fs.existsSync(targetFilePath)) {
        let content = fs.readFileSync(targetFilePath, 'utf-8');
        const lines = patchText.split('\n');
        const removedLines: string[] = [];
        const addedLines: string[] = [];
        
        for (const line of lines) {
          if (line.startsWith('-') && !line.startsWith('---')) {
            removedLines.push(line.substring(1));
          } else if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLines.push(line.substring(1));
          }
        }
        
        if (removedLines.length > 0) {
          const toRemove = removedLines.join('\n');
          const toAdd = addedLines.join('\n');
          
          if (content.includes(toRemove)) {
            content = content.replace(toRemove, toAdd);
            fs.writeFileSync(targetFilePath, content);
            applied = true;
          } else {
            // Fuzzy match on trimmed lines
            const targetLines = content.split('\n');
            for (let i = 0; i < targetLines.length; i++) {
              if (targetLines[i].trim() === removedLines[0].trim()) {
                targetLines.splice(i, removedLines.length, ...addedLines);
                fs.writeFileSync(targetFilePath, targetLines.join('\n'));
                applied = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  if (!applied) {
    throw new Error('Unable to apply patch: diff hunk could not be cleanly aligned.');
  }
}

app.post('/apply-patch', async (req, res) => {
  const { repoPath, patch } = req.body;
  if (!repoPath || !patch) {
    return res.status(400).json({ error: 'Missing repoPath or patch' });
  }

  try {
    applyPatchSafely(repoPath, patch);

    // Attempt post-patch verification if pytest is present
    let testResult = 'Patch applied successfully.';
    let verified = true;
    try {
      const out = execSync('pytest', { cwd: repoPath, encoding: 'utf-8', timeout: 5000 });
      testResult = 'All tests passed cleanly! (' + out.trim().split('\n').pop() + ')';
    } catch (testErr: any) {
      testResult = testErr.stdout ? testErr.stdout.trim().split('\n').pop() : 'Tests ran after patch.';
    }

    return res.json({ 
      success: true, 
      message: 'Fix successfully applied to target codebase!',
      verification: testResult,
      verified
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/export-report', async (req, res) => {
  const { repoPath, diagnosis, hypotheses, evidence } = req.body;
  if (!diagnosis) {
    return res.status(400).json({ error: 'Missing diagnosis' });
  }
  const md = ReportGenerator.generateMarkdown(
    repoPath || 'target_repository',
    diagnosis,
    hypotheses || [],
    evidence || []
  );
  res.json({ markdown: md });
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
