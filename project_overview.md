# Failure Prover — Project Overview & Architecture

**Last Updated:** August 22, 2026 | **Live URL:** https://failure-prover.onrender.com | **GitHub:** https://github.com/SurajPandey22/failure-prover

---

## 1. Introduction & Overview

### 🔷 Project Name
**Failure Prover** — Autonomous Verification-Driven AI Debugger

### 🎯 Core Purpose
Failure Prover automatically investigates **Python pytest failures**, traces the root cause using repository evidence, and generates a verified code patch — without any human debugging effort.

### 💡 The Problem (One sentence)
Developers waste hours manually tracing Python test failures through logs and source code, when an AI agent can do it in seconds with verifiable evidence.

### 👥 Who Uses It
| User | How it helps |
|---|---|
| **Python developers** | Instantly debug failing tests without manually reading tracebacks |
| **DevOps / CI teams** | Auto-heal broken CI pipelines with `npm run ci-heal` |
| **Hackathon judges** | See a live, end-to-end AI debugging demo with provable fixes |
| **QA engineers** | Get structured post-mortem reports for every failure |

---

## 2. Technical Architecture

### 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend** | Node.js 20 + TypeScript 5 | Type-safe, fast, robust API server |
| **AI Model** | Google Gemini 2.5 Flash | Multi-step reasoning + JSON structured output |
| **Frontend** | Vanilla HTML + Tailwind CSS | Zero build step, fast, responsive UI |
| **Auth** | SHA-256 hashed tokens + **Redis Cloud** | Sessions survive server restarts, 24hr auto-expiry |
| **Session Store** | Redis Labs Cloud | Cloud-native, persistent, 1-day TTL |
| **Testing** | Python + pytest | Target domain for bug investigation |
| **Deployment** | Docker + Render.com | Free, deploys from GitHub |
| **Observability** | Built-in telemetry singleton | Real-time latency, token & cost tracking, prompt hashing |

---

### 🗺️ High-Level Data Flow

```
USER BROWSER
     │
     │  1. POST /login or /signup  (username + password)
     ▼
┌────────────────────────────────────────┐
│           Node.js Server               │
│  - Validates credentials               │
│  - Issues auth token (64-char hex)     │
│  - Saves token → Redis Cloud (24hr TTL)│
│  - Saves user → data/users.json        │
└─────────────┬──────────────────────────┘
              │
              │  2. POST /upload-workspace (optional)
              │     Upload buggy .py files from browser
              │     → Creates isolated sandbox folder
              │     → Returns repoPath to UI automatically
              │
              │  3. POST /investigate-stream
              │     { log, repoPath, token }
              ▼
┌────────────────────────────────────────┐
│         INVESTIGATION ENGINE           │
│                                        │
│  Step 1: PARSER                        │
│  • Parses raw pytest traceback         │
│  • Extracts: failed tests,             │
│    error type, location, stack         │
│                                        │
│  Step 2: HYPOTHESIS GENERATOR          │
│  • Sends context → Gemini LLM          │
│  • Gets 2–4 structured hypotheses      │
│  • Each has: statement, location,      │
│    reasoning, proposed experiment      │
│                                        │
│  Step 3: EXPERIMENT RUNNER (Sandbox)   │
│  • list files (discover workspace)     │
│  • read file <path>                    │
│  • search files <query> (pure JS)      │
│  • run pytest -v                       │
│  • inspect git diff                    │
│  • 7-second sleep between LLM calls    │
│    (rate limit protection)             │
│                                        │
│  Step 4: EVIDENCE LEDGER               │
│  • Stores all evidence                 │
│  • Rule: LLM claims ≠ evidence         │
│  • Only repo/test output counts        │
│                                        │
│  Step 5: INDEPENDENT VERIFIER          │
│  • Second Gemini call judges           │
│    evidence objectively                │
│  • Verdict: SUPPORTED / REJECTED /     │
│    INCONCLUSIVE                        │
│                                        │
│  Step 6: PATCHER                       │
│  • If SUPPORTED → Gemini generates     │
│    unified git diff patch              │
│  • Applied to real Python file         │
│  • pytest -v runs to verify fix        │
└─────────────┬──────────────────────────┘
              │
              │  4. Server-Sent Events stream back to browser
              │     (live progress messages as JSON)
              ▼
┌────────────────────────────────────────┐
│           BROWSER UI                   │
│  • Live Stream tab: real-time logs     │
│  • Evidence Ledger: hypothesis cards   │
│    with SUPPORTED/REJECTED status      │
│  • Patch Studio: git diff viewer       │
│    + "Apply Fix Live" button           │
│  • Observability: tokens, cost,        │
│    latency, prompt version hashes      │
│  • Export Report: download .md         │
└────────────────────────────────────────┘
```

---

### 🏗️ Component Architecture (Deep Dive)

```
failure-prover/
├── src/                        ← TypeScript backend
│   ├── server.ts               ← Express API + Redis Auth + All Routes
│   ├── parser.ts               ← Pytest log parser (deterministic, no LLM)
│   ├── llm.ts                  ← GeminiLLM + FakeLLM + retry + observability
│   ├── loop.ts                 ← InvestigationLoop (orchestrator) + sleep gaps
│   ├── generator.ts            ← HypothesisGenerator LLM call
│   ├── execution.ts            ← ExperimentRunner (sandboxed, whitelisted cmds)
│   ├── ledger.ts               ← Evidence Ledger + invariant rules
│   ├── verifier.ts             ← IndependentVerifier (judge LLM)
│   ├── patcher.ts              ← Patch synthesizer + filesystem apply
│   ├── report.ts               ← Markdown report generator
│   ├── observability.ts        ← Telemetry singleton: cost, tokens, latency
│   └── domain.ts               ← Types: FailureContext, Hypothesis, Evidence...
│
├── frontend/
│   ├── index.html              ← Main dashboard (auth-gated, upload UI)
│   └── login.html              ← Login + Signup tabbed page
│
├── examples/                   ← 20 Python pytest benchmark repos
│   ├── parser_bug/             ← ValueError: int('AUTO')
│   ├── boundary_condition/     ← IndexError: empty list
│   ├── config_missing/         ← KeyError: 'timeout'
│   └── ... 17 more cases
│
├── scripts/
│   └── ci_auto_fix.ts          ← CI self-healing script
│
├── data/
│   ├── users.json              ← Registered users (SHA-256 hashed passwords)
│   └── workspaces/             ← Uploaded file sandboxes (auto-created per upload)
│
└── Dockerfile                  ← Node 20 Alpine + Python 3 + pytest
```

---

## 3. Key Features (Fully Implemented)

### 🔐 Auth System (Redis-Backed)
- Signup/Login with SHA-256 + salt hashed passwords
- Session tokens stored in **Redis Cloud** with **24-hour TTL**
- Tokens auto-expire — no manual cleanup needed
- Sessions **survive server restarts** (Render free tier spins down)
- Frontend auto-detects expired tokens (401) → auto-redirects to login

### 📁 Custom File Upload
- **Upload Files** button directly in the dashboard UI
- Accepts multiple `.py` files at once from your local computer
- Server creates a unique isolated sandbox directory per upload
- **Target Repo Path auto-fills** — no manual typing needed
- Works on the live cloud server (Render) — not just localhost!

### 🤖 AI Agent Sandbox Commands
| Command | What it does |
|---|---|
| `list files` | Discovers all files in the workspace (pure JS — no git needed) |
| `read file <path>` | Reads any source file from the repo |
| `search files <query>` | Full text search across all .py files (pure JS) |
| `run pytest -v` | Runs tests with verbose output for richer AI analysis |
| `inspect git diff` | Reads uncommitted changes (for git repos) |

### 📊 Observability Dashboard
- Real-time token counts (input + output per call)
- USD cost calculator per investigation session
- Millisecond latency per LLM call — in a live table
- Prompt template version + MD5 hash tracking

### 🛡️ Rate Limit Protection
- 7-second sleep between **every** Gemini LLM call
- Covers: HypothesisGenerator, AgentOrchestrator (x2 per step), IndependentVerifier, Patcher
- Skipped automatically during Jest tests (`NODE_ENV=test`)
- Plus: exponential backoff retry on 429/503 errors (up to 4 retries)

---

## 4. Auth Flow (Updated — Redis)

```
User visits /           →  No token in localStorage
                        →  Redirect to /login.html

/login.html opens       →  Two tabs: Sign In | Create Account

Create Account:
  username + password   →  POST /signup
  Server:               →  Hash password (SHA256 + salt)
                        →  Save to data/users.json
                        →  Generate 64-char random token
                        →  Store in Redis with 24hr TTL
                        →  Return { token, username }
  Browser:              →  Store token in localStorage
                        →  Redirect to /

Sign In:
  username + password   →  POST /login
  Server:               →  Load users.json
                        │  Compare password hash
                        │  Generate new token → Redis (24hr TTL)
  Browser:              →  Store token → Redirect to /

All API calls:          →  Header: x-auth-token: <token>
                        →  Server: Redis.exists(token)
                        →  401 if not found or expired

Token expires (24hr):   →  Next API call returns 401
                        →  Frontend auto-detects → logout()
                        →  User redirected to login page

Logout:                 →  POST /logout → Redis.del(token)
                        →  Clear localStorage
                        │  Redirect to /login.html
```

---

## 5. Key Design Decisions (Interview Q&A)

#### ❓ Why not just ask the LLM to fix the bug directly?
> Because **LLM claims are NOT evidence**. The model can hallucinate. Every hypothesis must be proven using **real repository files, test output, or git history** before a patch is generated. This is the core invariant enforced by the Evidence Ledger.

#### ❓ Why Redis for sessions instead of a simple in-memory Map?
> Render's free tier **spins down the server** when inactive. An in-memory Map is wiped on every restart, kicking out all logged-in users. Redis is an external cloud store that persists independently of the server. Tokens also automatically expire after 24 hours — no cleanup code needed.

#### ❓ Why does the upload feature work on the cloud server?
> When a user uploads files via the browser, the files are sent as JSON (base64 text content) in a `POST /upload-workspace` request. The Node.js server writes them to a new unique folder under `data/workspaces/`. The AI agent then investigates that folder path on the same server — so the cloud server *does* have access to those files because it just wrote them there!

#### ❓ Why use pure JS for `list files` and `search files` instead of shell commands?
> The old implementation used `git grep`. This fails in uploaded workspaces because there is no `.git` folder. The new pure-JS recursive implementation works everywhere, on any folder, with or without git. It also works on both Windows and Linux without any compatibility issues.

#### ❓ What is prompt versioning and why is it important?
> Prompt templates (e.g. `HypothesisGenerator v1.2.0`, `Patcher v2.0.0`) are version-controlled, and their **MD5 hashes** are calculated dynamically on startup. This allows tracking which exact prompt was used for which debugging trace, protecting against prompt regression during model updates.

#### ❓ How is latency and cost tracked?
> The `Observability` singleton wraps every LLM request. It calculates precise round-trip times in milliseconds, extracts `promptTokenCount` and `candidatesTokenCount` from Gemini response metadata, and calculates cost based on official Gemini pricing ($0.075/1M input tokens, $0.30/1M output tokens).

#### ❓ Why Server-Sent Events (SSE) instead of WebSockets?
> SSE is **simpler, one-directional, and HTTP-native** — perfect for streaming progress updates from server to browser. WebSockets add bidirectional complexity that isn't needed here.

#### ❓ How does the patcher apply the fix reliably?
> Multi-strategy approach:
> 1. Try `git apply --ignore-whitespace` (standard)
> 2. Try with `--directory` flag
> 3. Try `-p0`/`-p1` strip levels
> 4. **Semantic Diff Fallback**: If git fails, directly locate matching lines in the Python file and apply by string replacement

#### ❓ What prevents infinite LLM loops?
> Hard limits: **max 8 experiment steps** + **60 second runtime cap** enforced in `ExperimentRunner`. If exceeded, returns `LOW` confidence diagnosis and no patch.

#### ❓ How does the rate limit fix work?
> `GeminiLLM.generate()` catches HTTP 429 and 503, waits `Math.max(15000, 10000 × attempt)` ms, then retries up to 4 times. Additionally, the investigation loop adds a **7-second sleep before every single LLM call** to stay within the Gemini free-tier limit of 15 RPM.

#### ❓ What is Demo Fast Mode?
> Uses `FakeLLM` with **pre-scripted realistic responses** — completes the full investigation in ~1 second with zero API calls. Useful for live demos when network is slow or rate limits are hit.

---

## 6. Live Demo Guide (Interview)

### Scenario A: Using a Preset
1. Go to https://failure-prover.onrender.com → login
2. Select `parser bug` from the dropdown
3. Click **Start AI Investigation**
4. Point to Steps 1–5 lighting up as the AI works
5. Show **Evidence Ledger** and **Patch Studio** tabs

### Scenario B: Upload a New Bug (Most Impressive!)
1. Create `bank.py` with a bug (e.g. no check for negative amounts)
2. Create `test_bank.py` with a failing test
3. Click **Upload Files** → select both files → path auto-fills
4. Run `pytest test_bank.py` locally → copy the red error
5. Paste into the Failure Log box
6. Click **Start AI Investigation**
7. After AI finishes → click **Apply Fix Live**
8. Open `bank.py` — the file is physically fixed on the server!

---

> **Core Rule** (always mention this): *"The LLM's claims are NOT evidence. Evidence must come from the repository, logs, tests, command output, or git history."*
