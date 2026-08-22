<div align="center">

# 🔍 Failure Prover

### Autonomous Verification-Driven AI Debugger

[![Live Demo](https://img.shields.io/badge/Live%20Demo-failure--prover.onrender.com-blue?style=for-the-badge)](https://failure-prover.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-orange?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini)
[![Redis](https://img.shields.io/badge/Redis-Cloud-red?style=for-the-badge&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)](https://docker.com)

**Failure Prover is a multi-step AI Agent that autonomously investigates failing Python tests, generates evidence-backed hypotheses, and writes a Git diff patch to fix the bug — without any human guidance.**

</div>

---

## ✨ What Makes This Different

Most AI debugging tools just ask a language model: *"Here is an error, fix it."* Failure Prover doesn't do that.

It treats debugging as a **scientific investigation**. The AI Agent must:
1. Form a **hypothesis** about why the test failed.
2. **Run experiments** in a sandboxed environment to gather evidence.
3. Have its conclusions **independently verified** by a second LLM acting as a strict judge.
4. Only if verified, it writes a **Git Diff patch** to fix the code.

> Built from scratch in TypeScript — no LangChain, no CrewAI, no bloated frameworks.

---

## 🚀 Live Demo

**[https://failure-prover.onrender.com](https://failure-prover.onrender.com)**

- Create a free account and log in.
- Select a preset bug or upload your own Python files.
- Click **Start AI Investigation** and watch the agent think in real-time.
- View the evidence trail in the **Evidence Ledger** tab.
- Get the fix in the **Patch Studio** tab and apply it live!

---

## 🛠️ Feature List

### 🤖 AI Agent Engine
| Feature | Detail |
|---|---|
| **Hypothesis Generator** | Gemini 2.5 Flash generates 2-4 distinct, testable root-cause hypotheses from the failure log |
| **Autonomous Loop** | Runs up to 8 investigation steps, dynamically choosing what to do next |
| **Sandbox Executor** | Strict command whitelist: list files, read file, search files, run pytest -v, inspect git diff |
| **Evidence Ledger** | Centralized store tracking all evidence and hypothesis status per investigation |
| **Independent Verifier** | A completely separate LLM pass that acts as a judge |
| **Patcher** | Writes a unified Git Diff patch and applies it directly to the file system |
| **Rate Limit Guard** | 7-second sleep between every LLM call — survives Gemini free-tier limits |

### 🔐 Auth System
| Feature | Detail |
|---|---|
| **Signup / Login** | Secure token-based auth with SHA-256 hashed passwords |
| **Redis Sessions** | Tokens stored in Redis Cloud with automatic 24-hour expiration |
| **Server-Restart Safe** | Sessions survive Render server restarts |
| **Auto-Redirect** | Frontend automatically detects expired tokens and redirects to login |

### 📁 Custom File Upload
| Feature | Detail |
|---|---|
| **Browser Upload** | Upload any .py files directly from your computer via the UI |
| **Isolated Workspace** | Each upload creates a unique sandbox folder on the server |
| **No-Git Compatible** | Pure JS file discovery and search — works even with no .git folder |
| **Auto Path Fill** | Repo Path field automatically updates after upload |

### 📊 Observability Dashboard
| Feature | Detail |
|---|---|
| **Token Tracking** | Input and output token counts from every Gemini call |
| **Cost Calculator** | Real-time USD cost calculation |
| **Latency Traces** | Millisecond latency per LLM call in a live table |
| **Prompt Versioning** | MD5 hash and semantic version of every prompt template |

---

## 📦 Getting Started

### 1. Clone and Install
```bash
git clone https://github.com/SurajPandey22/failure-prover.git
cd failure-prover
npm install
```

### 2. Set Environment Variables
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export REDIS_URL="redis://default:password@host:port"
```

### 3. Run Locally
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Run Tests
```bash
npm test
# 29 tests across 8 suites
```

---

## 🐳 Docker

```bash
docker build -t failure-prover .
docker run -p 3000:10000 -e GEMINI_API_KEY="your-key" failure-prover
```

---

## 🎯 Demo: Upload and Debug Any Bug Live

1. Write a buggy Python file and its test file.
2. Open https://failure-prover.onrender.com and log in.
3. Click **Upload Files** and select your .py files.
4. Run pytest locally to get the error log and paste it in.
5. Click **Start AI Investigation**.
6. Watch the agent work through all 5 steps in real time.
7. Click **Apply Fix Live** in the Patch Studio!

---

## 🏗️ Project Structure

```
failure-prover/
├── src/
│   ├── server.ts        # Express server, auth, all API routes
│   ├── loop.ts          # Main investigation loop (AgentOrchestrator)
│   ├── generator.ts     # HypothesisGenerator LLM call
│   ├── verifier.ts      # IndependentVerifier LLM call
│   ├── patcher.ts       # Patch generation + filesystem apply
│   ├── execution.ts     # Sandbox executor (whitelisted commands)
│   ├── ledger.ts        # Evidence Ledger (in-memory store)
│   ├── llm.ts           # Gemini LLM adapter + FakeLLM for tests
│   ├── parser.ts        # Deterministic log parser (no LLM)
│   ├── observability.ts # Token/cost/latency telemetry singleton
│   └── domain.ts        # Core TypeScript interfaces
├── frontend/
│   ├── index.html       # Full single-page dashboard UI
│   └── login.html       # Login + Signup page
├── examples/            # 20 preset bug examples
├── data/
│   ├── users.json       # Registered user accounts
│   └── workspaces/      # Uploaded file sandboxes (auto-created)
├── tests/               # 29 Jest unit + integration tests
├── eval/                # 20-case evaluation harness
├── Dockerfile
└── README.md
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20 LTS |
| **Language** | TypeScript 5.x |
| **Web Framework** | Express 5 |
| **AI Model** | Google Gemini 2.5 Flash |
| **Session Store** | Redis Cloud (RedisLabs) |
| **Testing** | Jest + ts-jest |
| **Frontend** | Vanilla JS + Tailwind CSS |
| **Deployment** | Render (Docker) |
| **Container** | Node 20 Alpine + Python 3 + pytest |

---

## 🧪 Evaluation Harness

Run the built-in 20-case benchmark:
```bash
npm run eval
# Results saved to eval/results.json
```

---

## 📜 License

ISC © 2026 Suraj Pandey
