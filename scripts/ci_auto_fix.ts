#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Parser } from '../src/parser';
import { GeminiLLM, FakeLLM } from '../src/llm';
import { ExperimentRunner } from '../src/execution';
import { Ledger } from '../src/ledger';
import { InvestigationLoop } from '../src/loop';
import { ReportGenerator } from '../src/report';

/**
 * CI/CD Automated Self-Healing Script
 * Usage: npx ts-node scripts/ci_auto_fix.ts <repo-path> <log-path> [--auto-commit]
 */
async function runCiAutoFix() {
  const repoPath = process.argv[2] || '.';
  const logPath = process.argv[3];
  const autoCommit = process.argv.includes('--auto-commit');

  console.log('\n==============================================');
  console.log('🤖 FAILURE PROVER: CI/CD AUTONOMOUS HEALING BOT');
  console.log('==============================================\n');

  if (!logPath || !fs.existsSync(logPath)) {
    console.error(`❌ Failure log file not found at: ${logPath}`);
    console.log('Usage: npx ts-node scripts/ci_auto_fix.ts <repo-path> <failure.log> [--auto-commit]');
    process.exit(1);
  }

  const rawLog = fs.readFileSync(logPath, 'utf-8');
  const context = Parser.parse(rawLog);

  console.log(`🔍 Target Repository: ${repoPath}`);
  console.log(`📋 Failure Identified: ${context.failureLocation || 'Unknown'} - ${context.failureReason || 'Error'}\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  const llm = apiKey ? new GeminiLLM() : new FakeLLM();
  const runner = new ExperimentRunner(repoPath);
  const ledger = new Ledger();

  const loop = new InvestigationLoop(llm, runner, ledger, (msg) => {
    console.log(`  [CI AGENT] ${msg}`);
  });

  console.log('🚀 Launching multi-step autonomous investigation...');
  const diagnosis = await loop.run(context);

  console.log('\n==============================================');
  console.log('📊 INVESTIGATION COMPLETE');
  console.log('==============================================');
  console.log(`Root Cause: ${diagnosis.rootCause}`);
  console.log(`Confidence: ${diagnosis.confidence}`);

  // Generate Report
  const report = ReportGenerator.generateMarkdown(
    repoPath,
    diagnosis,
    ledger.getAllHypotheses(),
    ledger.getAllEvidence()
  );
  const reportPath = path.join(repoPath, 'CI_DIAGNOSIS_REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`📝 Generated CI report: ${reportPath}`);

  // Apply Patch if available
  if (diagnosis.suggestedFix) {
    console.log('\n🛠️ Synthesized Fix Diff:');
    console.log(diagnosis.suggestedFix);

    if (autoCommit) {
      console.log('\n⚡ Auto-commit enabled. Applying patch...');
      const patchFile = path.join(repoPath, '_ci_fix.patch');
      fs.writeFileSync(patchFile, diagnosis.suggestedFix);
      try {
        execSync('git apply _ci_fix.patch', { cwd: repoPath });
        fs.unlinkSync(patchFile);
        execSync('git add -A', { cwd: repoPath });
        execSync('git commit -m "fix(ci): autonomous fix by Failure Prover [skip ci]"', { cwd: repoPath });
        console.log('✅ Fix committed to branch successfully!');
      } catch (err: any) {
        if (fs.existsSync(patchFile)) fs.unlinkSync(patchFile);
        console.error(`⚠️ Could not auto-commit patch: ${err.message}`);
      }
    }
  }

  process.exit(0);
}

runCiAutoFix().catch((err) => {
  console.error(`💥 CI Bot Fatal Error: ${err.message}`);
  process.exit(1);
});
