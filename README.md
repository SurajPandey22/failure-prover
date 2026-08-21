# Failure Prover

**Autonomous Verification-Driven AI Debugger**

Failure Prover is an AI-powered debugging tool designed to strictly verify LLM claims against objective repository evidence. Instead of blindly trusting a single LLM to fix a codebase, Failure Prover relies on an **Evidence Ledger** and an **Independent Verifier** to ensure every hypothesis is thoroughly proven via safe sandbox execution (`cat`, `git diff`, `pytest`).

Built entirely from scratch in Node.js/TypeScript without bloated frameworks like LangChain or CrewAI, prioritizing speed, determinism, and safety.

## 🚀 Features
- **Phase 1: Deterministic Log Parsing.** Non-LLM extraction of failure context.
- **Phase 2: Hypothesis Generation.** Forces the LLM to output 2-4 distinct, testable hypotheses.
- **Phase 3: Sandbox Execution.** A strict execution loop limited to safe read-only operations and test runs (`MAX_STEPS=8`, `MAX_TESTS=3`).
- **Phase 4: Evidence Ledger.** A centralized, in-memory ledger tracking what the LLM claims vs. what the repository objectively proves.
- **Phase 5: Independent Verifier.** A secondary LLM pass acting strictly as a judge—a hypothesis cannot be `SUPPORTED` without hard repository evidence.
- **Evaluation Harness.** Built-in 20-case dataset spanning boundary logic, config missing, data validation, and more to continuously benchmark accuracy.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, TypeScript
- **LLM Boundary:** Google Gemini (`gemini-2.5-pro`) via REST API
- **Execution:** Node `child_process` and `fs`
- **Frontend:** Vanilla JS + HTML + TailwindCSS

## 📦 Installation & Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/SurajPandey22/failure-prover.git
   cd failure-prover
   npm install
   ```

2. **Environment Variables**
   Export your Gemini API Key:
   ```bash
   export GEMINI_API_KEY="your-api-key"
   ```

3. **Run the API & UI**
   ```bash
   npm run dev
   # Or for production: npm start
   ```
   Navigate to `http://localhost:8080` to see the UI.

## 🧪 Evaluation Harness
To benchmark the architecture against the 20 internal test cases:
```bash
npm run eval
```
Results will be outputted to `eval/results.json`.

## 🐳 Docker (Deployment)
```bash
docker build -t failure-prover .
docker run -p 8080:8080 -e GEMINI_API_KEY="your-api-key" failure-prover
```
