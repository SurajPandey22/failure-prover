import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './parser';
import { GeminiLLM } from './llm';
import { ExperimentRunner } from './execution';
import { Ledger } from './ledger';
import { InvestigationLoop } from './loop';

async function main() {
  const repoPath = process.argv[2];
  const logPath = process.argv[3];

  if (!repoPath || !logPath) {
    console.error('Usage: npx ts-node src/index.ts <repo-path> <log-path>');
    process.exit(1);
  }

  const rawLog = fs.readFileSync(logPath, 'utf-8');
  const context = Parser.parse(rawLog);

  const llm = new GeminiLLM();
  const runner = new ExperimentRunner(repoPath);
  const ledger = new Ledger();
  const loop = new InvestigationLoop(llm, runner, ledger);

  console.log('Starting investigation...');
  const diagnosis = await loop.run(context);

  console.log('\n--- DIAGNOSIS ---');
  console.log(JSON.stringify(diagnosis, null, 2));

  console.log('\n--- LEDGER ---');
  console.log('Hypotheses:', JSON.stringify(ledger.getAllHypotheses(), null, 2));
  console.log('Evidence:', JSON.stringify(ledger.getAllEvidence(), null, 2));
}

main().catch(console.error);
