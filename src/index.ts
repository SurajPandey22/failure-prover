import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './parser';
import { GeminiLLM } from './llm';
import { ExperimentRunner } from './execution';
import { Ledger } from './ledger';
import { InvestigationLoop } from './loop';

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
  const repoPath = process.argv[2];
  const logPath = process.argv[3];

  if (!repoPath || !logPath) {
    console.error(`${colors.red}Usage: npx ts-node src/index.ts <repo-path> <log-path>${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.cyan}==========================================`);
  console.log(` FAILURE PROVER - AUTONOMOUS AI DEBUGGER`);
  console.log(`==========================================${colors.reset}\n`);

  const rawLog = fs.readFileSync(logPath, 'utf-8');
  const context = Parser.parse(rawLog);

  const llm = new GeminiLLM();
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
    
    if (process.argv.includes('--apply')) {
      console.log(`${colors.yellow}Applying fix automatically...${colors.reset}`);
      const patchPath = path.join(repoPath, 'fix.patch');
      fs.writeFileSync(patchPath, diagnosis.suggestedFix);
      
      try {
        const { execSync } = require('child_process');
        execSync(`git apply fix.patch`, { cwd: repoPath });
        console.log(`${colors.green}Fix successfully applied!${colors.reset}`);
      } catch (e: any) {
        console.error(`${colors.red}Failed to apply patch: ${e.message}${colors.reset}`);
      } finally {
        fs.unlinkSync(patchPath);
      }
    } else {
      console.log(`(Run with ${colors.cyan}--apply${colors.reset} to automatically apply this fix)`);
    }
  } else {
    console.log(`\n${colors.red}No confident fix could be generated.${colors.reset}\n`);
  }
}

main().catch(e => {
  console.error(`${colors.red}Fatal Error: ${e.message}${colors.reset}`);
});
