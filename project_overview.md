# Failure Prover — Project Overview & Architecture

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
| **Backend** | Node.js + TypeScript | Type-safe, fast, robust API server |
| **AI Model** | Google Gemini 1.5 Flash (via REST API) | Multi-step reasoning + JSON structured output |
| **Frontend** | Vanilla HTML + Tailwind CSS | Zero build step, fast, responsive UI |
| **Auth** | SHA-256 hashed tokens + JSON file store | Simple, no DB needed for hackathon |
| **Testing** | Python + pytest | Target domain for bug investigation |
| **Deployment** | Docker + Render.com | Free, auto-deploy from GitHub |
| **CI/CD** | GitHub Actions compatible (`ci-heal` script) | Real-world usage integration |
| **Observability**| Built-in dynamic telemetry system | Real-time latency tracing, token & cost tracking, prompt templates hashing |

---

### 🗺️ High-Level Data Flow

```
USER BROWSER
     │
     │  1. POST /login or /signup  (username + password)
     ▼
┌────────────────────────────────────┐
│         Node.js Server             │
│  - Validates credentials           │
│  - Issues auth token (SHA-256)     │
│  - Saves users → data/users.json   │
└─────────────┬──────────────────────┘
              │
              │  2. POST /investigate-stream
              │     { log, repoPath, token }
              ▼
┌────────────────────────────────────┐
│       INVESTIGATION ENGINE         │
│                                    │
│  Step 1: PARSER                    │
│  • Parses raw pytest traceback     │
│  • Extracts: failed tests,         │
│    error type, location, stack     │
│                                    │
│  Step 2: HYPOTHESIS GENERATOR      │
│  • Sends context → Gemini LLM      │
│  • Gets 1–3 structured hypotheses  │
│  • Each has: statement, location,  │
│    reasoning, proposed experiment  │
│                                    │
│  Step 3: EXPERIMENT RUNNER         │
│  • Runs sandboxed commands:        │
│    "read file parser.py"           │
│    "search int(parts[2])"          │
│    "pytest"                        │
│  • Reads REAL repo files/output    │
│                                    │
│  Step 4: EVIDENCE LEDGER           │
│  • Stores all evidence             │
│  • Rule: LLM claims ≠ evidence     │
│  • Only repo/test output counts    │
│                                    │
│  Step 5: INDEPENDENT VERIFIER      │
│  • Second Gemini call judges       │
│    evidence objectively            │
│  • Verdict: SUPPORTED/REJECTED/    │
│    INCONCLUSIVE                    │
│                                    │
│  Step 6: PATCHER                   │
│  • If SUPPORTED → Gemini generates │
│    unified git diff patch          │
│  • Applied to real Python file     │
│  • pytest runs to verify fix       │
└─────────────┬──────────────────────┘
              │
              │  3. Server-Sent Events stream back to browser
              │     (live progress messages as JSON)
              ▼
┌────────────────────────────────────┐
│         BROWSER UI                 │
│  • Live Stream tab: real-time logs │
│  • Evidence Ledger: hypothesis     │
│    cards with SUPPORTED/REJECTED   │
│  • Patch Studio: git diff viewer   │
│    + "Apply Fix Live" button       │
│  • Observability tab: live tokens, │
│    latency, cost, prompt hashes    │
│  • Export Report: download .md     │
└────────────────────────────────────┘
```

---

### 🏗️ Component Architecture (Deep Dive)

```
failure-prover/
├── src/                        ← TypeScript backend
│   ├── server.ts               ← Express API + Auth + Routes
│   ├── parser.ts               ← Pytest log parser (deterministic)
│   ├── llm.ts                  ← GeminiLLM + FakeLLM + retry logic
│   ├── loop.ts                 ← InvestigationLoop (orchestrator)
│   ├── generator.ts            ← HypothesisGenerator
│   ├── execution.ts            ← ExperimentRunner (sandboxed cmds)
│   ├── ledger.ts               ← Evidence Ledger + invariant rules
│   ├── verifier.ts             ← IndependentVerifier (judge LLM)
│   ├── patcher.ts              ← Patch synthesizer
│   ├── report.ts               ← Markdown report generator
│   ├── observability.ts        ← Telemetry: costs, tokens, versions
│   └── domain.ts               ← Types: FailureContext, Hypothesis...
│
├── frontend/
│   ├── index.html              ← Main dashboard (auth-gated)
│   └── login.html              ← Login + Signup page
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
│   └── users.json              ← Registered users (hashed passwords)
│
└── Dockerfile                  ← Production container
```

---

### 🔑 Key Design Decisions (For Cross-Questions)

#### ❓ Why not just ask the LLM to fix the bug directly?
> Because **LLM claims are NOT evidence**. The model can hallucinate. Every hypothesis must be proven using **real repository files, test output, or git history** before a patch is generated. This is the core invariant enforced by the Evidence Ledger.

#### ❓ What is prompt versioning and why is it important?
> Prompt templates (e.g. `HypothesisGenerator v1.2.0`, `Patcher v2.0.0`) are version-controlled, and their **MD5 hashes** are calculated dynamically on startup. This allows us to track which prompts were used for which debugging traces, protecting us against prompt regression during model updates.

#### ❓ How is latency and cost tracked?
> The `Observability` singleton wraps every LLM request. It calculates precise round-trip times in milliseconds, extracts `promptTokenCount` and `candidatesTokenCount` from Gemini response metadata, and calculates cost based on the official Gemini pricing models ($0.075 / 1M input tokens, $0.30 / 1M output tokens).

#### ❓ Why Server-Sent Events (SSE) instead of WebSockets?
> SSE is **simpler, one-directional, and HTTP-native** — perfect for streaming progress updates from server to browser. WebSockets add bidirectional complexity we don't need here.

#### ❓ How does the patcher apply the fix reliably?
> Multi-strategy approach:
> 1. Try `git apply --ignore-whitespace` (standard)
> 2. Try with `--directory` flag
> 3. Try `-p0`/`-p1` strip levels
> 4. **Semantic Diff Fallback**: If git fails, directly locate matching lines in the Python file and apply the change by string replacement

#### ❓ What prevents infinite LLM loops?
> Hard limits: **max 8 experiment steps** + **60 second runtime cap** enforced in `ExperimentRunner`. If exceeded, returns `LOW` confidence diagnosis and no patch.

#### ❓ How is auth handled without a database?
> Users stored in `data/users.json` with **SHA-256 hashed passwords** (salted). Session tokens are **64-char hex random strings** stored in server memory. Works perfectly for a demo/hackathon scale.

#### ❓ How does the Rate Limit retry work?
> `GeminiLLM.generate()` catches HTTP 429 (rate limit) and 503 (unavailable), waits `Math.max(15000, 10000 * attempt)` ms, then retries up to 4 times with exponential backoff.

#### ❓ What is Demo Fast Mode?
> Uses `FakeLLM` with **pre-scripted realistic responses** — completes the full investigation in ~1 second with zero API calls. Useful for live demos when network is slow or rate limits are hit.

---

### 🔄 Auth Flow (Detailed)

```
User visits /           →  No token in localStorage
                        →  Redirect to /login.html

/login.html opens       →  Two tabs: Sign In | Create Account

Create Account:
  username + password   →  POST /signup
  Server:               →  Hash password (SHA256 + salt)
                        →  Save to data/users.json
                        →  Generate 64-char token
                        →  Return { token, username }
  Browser:              →  Store token in localStorage
                        →  Redirect to /

Sign In:
  username + password   →  POST /login
  Server:               →  Load users.json
                        →  Compare password hash
                        →  Generate new token
  Browser:              →  Store token → Redirect to /

All API calls:          →  Header: x-auth-token: <token>
                        →  Server checks activeSessions Map
                        →  401 if token not found

Logout:                 →  POST /logout (removes from Map)
                        →  Clear localStorage
                        →  Redirect to /login.html
```

---

> **Core Rule** (always mention this): *"The LLM's claims are NOT evidence. Evidence must come from the repository, logs, tests, command output, or git history."*
