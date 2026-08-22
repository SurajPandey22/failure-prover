# 🔍 Failure Prover

### **Autonomous Verification-Driven AI Debugger**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-failure--prover.onrender.com-blue?style=for-the-badge)](https://failure-prover.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-orange?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini)
[![Redis](https://img.shields.io/badge/Redis-Cloud-red?style=for-the-badge&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)](https://docker.com)

Failure Prover is an autonomous, multi-agent system designed to investigate Python test failures (`pytest`), formulate root-cause hypotheses, run sandboxed experiments to collect physical evidence, verify claims independently, and generate a verified Git diff patch to auto-heal the codebase.

---

## 📖 Table of Contents
1. [Core Design Philosophy](#-core-design-philosophy)
2. [System Architecture](#-system-architecture)
3. [Component Breakdown](#-component-breakdown)
4. [Tech Stack](#-tech-stack)
5. [Authentication & Redis Session Flow](#-authentication--redis-session-flow)
6. [Sandbox Executor & Command Security](#-sandbox-executor--command-security)
7. [Installation & Local Setup](#-installation--local-setup)
8. [Docker & Production Deployment](#-docker--production-deployment)
9. [Evaluation Harness (20-Case Benchmark)](#-evaluation-harness-20-case-benchmark)
10. [Interview Demo Guide (Live File Upload)](#-interview-demo-guide-live-file-upload)

---

## 🧠 Core Design Philosophy

Most AI code assistants follow a simple, flawed pattern: **Prompt ➔ Generate Code**. This often leads to hallucinations, compile errors, or broken tests because the LLM is guessing.

Failure Prover operates on the **scientific method**:
*   **LLM claims are NOT evidence.** What the LLM thinks is wrong does not count as truth.
*   **Centralized Evidence Ledger:** Hypotheses are only supported when backed by physical evidence (file reads, regex searches, test outputs).
*   **Separate Judicial Verification:** An independent judge LLM evaluates the ledger state. The agent loop cannot verify its own hypotheses.

---

## 🗺️ System Architecture

### High-Level Data Flow

```mermaid
graph TD
    A[Failing Pytest Log] --> B[Log Parser - No LLM]
    B -->|Failure Context| C[Hypothesis Generator]
    C -->|2-4 Pending Hypotheses| D[Evidence Ledger]
    
    subgraph Autonomous Investigation Loop
        D -->|Orchestrator Selects Pending| E[Gemini Flash Agent]
        E -->|Chooses Whitelisted Command| F[Sandbox Executor]
        F -->|Reads Files/Runs Pytest| G[Collects Output]
        G -->|Parses Evidence| H[Update Evidence Ledger]
        H -->|Updates State| D
    end
    
    D -->|Supported Hypothesis| I[Independent Verifier LLM]
    I -->|Verifies Evidence Trail| J{Verdict}
    
    J -->|Approved| K[Patcher LLM]
    J -->|Rejected| L[Loop Continues / Fails]
    
    K -->|Synthesizes Diff| M[Apply Patch Safely]
    M -->|Runs Final Pytest| N((Verified Success))
```

---

## 🏗️ Component Breakdown

*   **`src/server.ts`**: The main Express application. Handles CORS headers, user accounts, Redis session storage, and routes requests to the loop or file upload sandboxes.
*   **`src/parser.ts`**: A regex-based, deterministic parser. Extracts the failure message, file name, line number, and stack trace from raw `pytest` outputs without wasting LLM tokens.
*   **`src/loop.ts`**: The orchestrator (`InvestigationLoop`). Coordinates the agent steps, evaluates evidence, runs the verifier and patcher, and yields real-time streaming progress to the client via Server-Sent Events (SSE).
*   **`src/generator.ts`**: Leverages Gemini Flash to formulate 2 to 4 candidate hypotheses with proposed validation experiments.
*   **`src/execution.ts`**: The sandbox executor. Constrains the agent to safe read-only operations (`cat`, `list_files`, text searches) and test runs. It includes a pure-JS fallback for workspaces without Git.
*   **`src/ledger.ts`**: Holds the runtime state of all hypotheses, linking them to supporting and disproving pieces of physical evidence.
*   **`src/verifier.ts`**: Evaluates the collected evidence against a hypothesis in a separate, isolated context to confirm validity.
*   **`src/patcher.ts`**: Automatically writes a git-compatible unified diff and attempts to apply it. If standard patch utility fails, it uses a string-replacement search fallback.
*   **`src/observability.ts`**: A singleton tracking API call latency, token usage (input/output), cost tracking in USD, and MD5 hashes of prompt versions.

---

## 🛠️ Tech Stack

*   **Backend Runtime:** Node.js 20 LTS
*   **Programming Language:** TypeScript 5.x
*   **API Framework:** Express 5 (routing with path-to-regexp v8 compatibility)
*   **LLM Provider:** Google Gemini API (using `gemini-2.5-flash`)
*   **Session Database:** Redis Labs Cloud (Token TTL: 24 Hours)
*   **Unit Tests:** Jest + `ts-jest`
*   **Frontend UI:** Vanilla HTML5 + Tailwind CSS (Zero build toolchain, raw script loading)

---

## 🔐 Authentication & Redis Session Flow

To support deployments on cloud platforms with ephemeral containers (such as Render Free Tier), session state is offloaded to a persistent Redis cloud server.

```
[Browser]                     [Node.js Server]                     [Redis Cloud]
    │                                │                                   │
    ├───── POST /signup ────────────▶│                                   │
    │      (username, password)      ├─ Hash Password (SHA-256)          │
    │                                ├─ Generate Token                   │
    │                                ├─ SETEX token 86400 "user" ───────▶│
    │◀──── Return Token ─────────────┤                                   │
    │                                │                                   │
    ├───── API Request ─────────────▶│                                   │
    │      Header: x-auth-token      ├─ EXISTS token ───────────────────▶│
    │                                ◀─ Return true ─────────────────────┤
    │◀──── Process Route ────────────┤                                   │
    │                                │                                   │
    │      (Token Expired >24hr)     │                                   │
    ├───── API Request ─────────────▶│                                   │
    │      Header: x-auth-token      ├─ EXISTS token ───────────────────▶│
    │                                ◀─ Return false ────────────────────┤
    │◀──── 401 Unauthorized ─────────┤                                   │
    │                                │                                   │
    ├─ (Frontend auto-logout)        │                                   │
    └─ Redirect to /login.html ──────┘
```

---

## 🛡️ Sandbox Executor & Command Security

The agent cannot execute arbitrary shell commands. `ExperimentRunner` parses and sanitizes commands using a strict whitelist. If the agent tries to run malicious scripts, the sandbox rejects it.

| Whitelisted Command | Executed Functionality | Security Boundary |
|---|---|---|
| `list files` | Recursively traverses directory to list paths | Pure JS implementation; prevents shell command injection |
| `read file <path>` | Node `fs.readFileSync` on combined path | Path traversal check via `path.join`; cannot read parent directories |
| `search files <query>` | Scans file contents for matched string | Pure JS scanning; avoids spawning shell grep utilities |
| `run pytest` | Spawns `pytest -v` | Executed in the target path only; execution limit of `MAX_TEST_RUNS=3` |
| `inspect git diff` | Spawns `git diff` | Read-only check for repository modifications |

---

## 📦 Installation & Local Setup

### Prerequisites
*   Node.js (v20 or higher)
*   Python 3 + `pip install pytest`
*   A Gemini API Key (obtained from Google AI Studio)

### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/SurajPandey22/failure-prover.git
    cd failure-prover
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Configure your terminal or create a `.env` file with:
    ```bash
    export GEMINI_API_KEY="your_gemini_api_key"
    export REDIS_URL="redis://default:password@host:port"
    ```

4.  **Run the Server**
    ```bash
    npm run dev
    # The application will start on http://localhost:3000
    ```

5.  **Run Test Suites**
    Verify the entire backend logic with 29 integration and unit tests:
    ```bash
    npm test
    ```

---

## 🐳 Docker & Production Deployment

### Docker Setup
We package Node, Python, and Pytest together inside a lightweight Alpine container.

```bash
# Build the container
docker build -t failure-prover .

# Run the container
docker run -p 3000:10000 -e GEMINI_API_KEY="your-gemini-key" failure-prover
```

### Deploying to Render
1.  Connect your Forked GitHub repository to a new **Web Service** on Render.
2.  Set the environment variable `GEMINI_API_KEY`.
3.  Set the environment variable `REDIS_URL` (points to your Redis Labs cloud instance).
4.  Deploy. Render will use the root `Dockerfile` to build and serve the application automatically on port `10000`.

---

## 🧪 Evaluation Harness (20-Case Benchmark)

To benchmark the debugger agent, we built a 20-case dataset in `examples/`. It evaluates the agent across:
*   **Boundary Conditions** (index errors, empty lists)
*   **Missing Configurations** (absent variables)
*   **Data Validation** (string parsing failures)

Run the evaluation harness:
```bash
npm run eval
```
The results, including success rates and token usage metrics, are written to `eval/results.json`.

---

## 🎯 Interview Demo Guide (Live File Upload)

Follow this step-by-step path to demo this app live in a technical interview:

### 1. The Setup (Show the Bug)
Create a new directory locally (`examples/live_test`) with a buggy python file (`bank.py`):
```python
# bank.py
def withdraw(balance, amount):
    if amount > balance:
        raise ValueError("Insufficient funds")
    # BUG: Forgot to check if the amount is negative!
    return balance - amount
```
And its corresponding test file (`test_bank.py`):
```python
# test_bank.py
from bank import withdraw

def test_negative_withdrawal():
    try:
        withdraw(100, -50)
        assert False, "Allowed negative withdrawal!"
    except ValueError:
        pass
```

### 2. Run the Test Locally & Get the Log
Run the test in your console:
```bash
pytest examples/live_test/test_bank.py
```
Copy the red traceback error output.

### 3. Open the UI & Upload
1.  Go to `https://failure-prover.onrender.com` (or `localhost:3000`).
2.  Click **Upload Files** and select both `bank.py` and `test_bank.py`. The **Target Repo Path** will automatically update to the server's workspace folder.
3.  Paste the pytest error traceback into the **Pytest Failure Log** box.
4.  Click **Start AI Investigation**.

### 4. The Scientific Trace
*   Show the **Live Stream** log showing the 7-second rate-limiter pauses.
*   Point out the **Evidence Ledger** as the AI reads `bank.py` and marks the hypothesis as `SUPPORTED`.
*   Click **Apply Fix Live** in the **Patch Studio** tab. Show that the backend successfully applied the diff patch, re-ran pytest, and verified it with a green status: `"All tests passed cleanly!"`

---

## 📜 License

Distributed under the ISC License. Copyright © 2026 Suraj Pandey.
