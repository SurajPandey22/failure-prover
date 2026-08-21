import * as fs from 'fs';
import * as path from 'path';
import { Parser } from '../src/parser';
import { GeminiLLM } from '../src/llm';
import { ExperimentRunner } from '../src/execution';
import { Ledger } from '../src/ledger';
import { InvestigationLoop } from '../src/loop';

async function runEval() {
  const examplesDir = path.join(__dirname, '../examples');
  const dirs = fs.readdirSync(examplesDir);
  const results: any[] = [];

  for (const d of dirs) {
    const casePath = path.join(examplesDir, d);
    if (!fs.statSync(casePath).isDirectory()) continue;

    const logPath = path.join(casePath, 'failure.log');
    const expectedPath = path.join(casePath, 'expected.json');

    if (!fs.existsSync(logPath) || !fs.existsSync(expectedPath)) continue;

    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    const rawLog = fs.readFileSync(logPath, 'utf-8');
    const context = Parser.parse(rawLog);

    console.log(\`Evaluating case: \${d}...\`);

    const llm = new GeminiLLM();
    const runner = new ExperimentRunner(casePath);
    const ledger = new Ledger();
    const loop = new InvestigationLoop(llm, runner, ledger);

    const startTime = Date.now();
    let diagnosis;
    let error = null;

    try {
      diagnosis = await loop.run(context);
    } catch (e: any) {
      error = e.message;
    }

    const duration = Date.now() - startTime;
    const isCorrect = diagnosis && diagnosis.rootCause.includes(expected.rootCause_file) || false;

    results.push({
      case: d,
      durationMs: duration,
      isCorrect,
      steps: runner.getRecords().length,
      diagnosis,
      expected,
      error
    });
  }

  const report = {
    totalCases: results.length,
    correctCases: results.filter(r => r.isCorrect).length,
    averageSteps: results.reduce((a, b) => a + b.steps, 0) / (results.length || 1),
    averageRuntime: results.reduce((a, b) => a + b.durationMs, 0) / (results.length || 1),
    results
  };

  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
  console.log('Evaluation complete. Report saved to eval/results.json');
}

runEval().catch(console.error);
