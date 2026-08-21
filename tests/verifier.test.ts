import { Verifier } from '../src/verifier';
import { FakeLLM } from '../src/llm';
import { FailureContext, Hypothesis, HypothesisStatus, ConfidenceLevel, EvidenceSourceType } from '../src/domain';

describe('Verifier', () => {
  let verifier: Verifier;
  let llm: FakeLLM;
  const dummyCtx: FailureContext = { rawLog: '', sourceLocations: [], relevantLogLines: [] };
  const dummyHyp: Hypothesis = {
    id: '1', statement: 'x', status: HypothesisStatus.PENDING, confidence: ConfidenceLevel.LOW,
    evidenceFor: [], evidenceAgainst: [], experimentIds: []
  };

  beforeEach(() => {
    llm = new FakeLLM();
    verifier = new Verifier(llm);
  });

  it('verifier rejects (investigator said supported but verifier disagrees)', async () => {
    llm.responses.push(`{"status": "REJECTED"}`);
    const res = await verifier.verify(dummyHyp, [], [], dummyCtx);
    expect(res).toBe(HypothesisStatus.REJECTED);
  });

  it('verifier inconclusive', async () => {
    llm.responses.push(`{"status": "INCONCLUSIVE"}`);
    const res = await verifier.verify(dummyHyp, [], [], dummyCtx);
    expect(res).toBe(HypothesisStatus.INCONCLUSIVE);
  });

  it('both agree (supported)', async () => {
    llm.responses.push(`{"status": "SUPPORTED"}`);
    const res = await verifier.verify(dummyHyp, [], [], dummyCtx);
    expect(res).toBe(HypothesisStatus.SUPPORTED);
  });

  it('evidence is insufficient (returns inconclusive gracefully on bad output)', async () => {
    llm.responses.push(`bad response`);
    const res = await verifier.verify(dummyHyp, [], [], dummyCtx);
    expect(res).toBe(HypothesisStatus.INCONCLUSIVE);
  });
});
