import { InvestigationLoop } from '../src/loop';
import { FakeLLM } from '../src/llm';
import { ExperimentRunner } from '../src/execution';
import { FailureContext, HypothesisStatus } from '../src/domain';
import * as fs from 'fs';
import * as path from 'path';

import { Ledger } from '../src/ledger';
import { HypothesisGenerator } from '../src/generator';
import { Verifier } from '../src/verifier';

describe('InvestigationLoop', () => {
  const dummyRepo = path.join(__dirname, 'dummy_repo_loop');

  beforeAll(() => {
    if (!fs.existsSync(dummyRepo)) fs.mkdirSync(dummyRepo);
    fs.writeFileSync(path.join(dummyRepo, 'dummy.txt'), 'content');
  });

  afterAll(() => {
    fs.unlinkSync(path.join(dummyRepo, 'dummy.txt'));
    fs.rmdirSync(dummyRepo);
  });

  it('should run end-to-end investigation with fake model', async () => {
    const llm = new FakeLLM();
    // 1. hypotheses generation
    llm.responses.push(`[{"statement": "bug in parsing", "likelySourceLocation": "x", "reasoning": "y", "proposedExperiment": "read file dummy.txt"}]`);
    // 2. choose experiment
    llm.responses.push('read file dummy.txt');
    // 3. evaluate evidence
    llm.responses.push(`{"supports": true, "contradicts": false, "reason": "matches"}`);
    // 4. verifier 
    llm.responses.push(`{"status": "SUPPORTED"}`);

    const runner = new ExperimentRunner(dummyRepo);
    const ledger = new Ledger();
    const loop = new InvestigationLoop(llm, runner, ledger);
    
    const ctx: FailureContext = { rawLog: '', sourceLocations: [], relevantLogLines: [] };
    const diagnosis = await loop.run(ctx);

    expect(diagnosis.rootCause).toBe('bug in parsing');
    expect(diagnosis.experiments).toContain('read file dummy.txt');
  });
});
