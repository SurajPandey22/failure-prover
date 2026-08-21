import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './src/parser';
import { FakeLLM } from './src/llm';
import { ExperimentRunner } from './src/execution';
import { Ledger } from './src/ledger';
import { InvestigationLoop } from './src/loop';

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
};

async function main() {
  const repoPath = './examples/parser_bug';
  const logPath = './examples/parser_bug/failure.log';

  console.log(`\n${colors.bright}${colors.cyan}==========================================`);
  console.log(` FAILURE PROVER - AUTONOMOUS AI DEBUGGER (MOCK DEMO)`);
  console.log(`==========================================${colors.reset}\n`);

  const rawLog = fs.readFileSync(logPath, 'utf-8');
  const context = Parser.parse(rawLog);

  const llm = new FakeLLM();
  // Mock LLM responses for the parser_bug
  llm.responses.push(JSON.stringify([
    {
      "statement": "The parser expects 'age' to be numeric, but it receives 'AUTO'",
      "likelySourceLocation": "parser.py:8",
      "reasoning": "The stack trace points to int(parts[2]) failing on 'AUTO'",
      "proposedExperiment": "read file parser.py"
    }
  ]));
  llm.responses.push("read file parser.py");
  llm.responses.push(JSON.stringify({ "supports": true, "contradicts": false, "reason": "The code hardcodes int() conversion" }));
  llm.responses.push(JSON.stringify({ "status": "SUPPORTED" })); // Verifier
  llm.responses.push(`
--- a/parser.py
+++ b/parser.py
@@ -7,3 +7,6 @@
-    age = int(parts[2])
+    try:
+        age = int(parts[2])
+    except ValueError:
+        age = parts[2]
`); // Patcher

  const runner = new ExperimentRunner(repoPath);
  const ledger = new Ledger();
  
  const onProgress = (msg: string) => {
    console.log(`${colors.blue}[AGENT]${colors.reset} ${msg}`);
  };

  const loop = new InvestigationLoop(llm, runner, ledger, onProgress);

  console.log(`${colors.yellow}Starting investigation for: ${repoPath}${colors.reset}\n`);
  
  const diagnosis = await loop.run(context);

  console.log(`\n${colors.bright}${colors.cyan}==========================================`);
  console.log(` DIAGNOSIS COMPLETE`);
  console.log(`==========================================${colors.reset}\n`);
  
  console.log(`${colors.bright}Root Cause:${colors.reset} ${diagnosis.rootCause}`);
  console.log(`${colors.bright}Confidence:${colors.reset} ${diagnosis.confidence === 'HIGH' ? colors.green : colors.yellow}${diagnosis.confidence}${colors.reset}`);
  
  if (diagnosis.suggestedFix) {
    console.log(`\n${colors.bright}${colors.green}--- SUGGESTED FIX (GIT DIFF) ---${colors.reset}`);
    console.log(diagnosis.suggestedFix);
    console.log(`${colors.green}--------------------------------${colors.reset}\n`);
  }
}

main().catch(console.error);
