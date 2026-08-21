import { Ledger } from '../src/ledger';
import { Hypothesis, HypothesisStatus, ConfidenceLevel, Evidence, EvidenceSourceType } from '../src/domain';

describe('Evidence Ledger', () => {
  let ledger: Ledger;
  let baseHypothesis: Hypothesis;

  beforeEach(() => {
    ledger = new Ledger();
    baseHypothesis = {
      id: 'h1',
      statement: 'Test',
      status: HypothesisStatus.PENDING,
      confidence: ConfidenceLevel.LOW,
      evidenceFor: [],
      evidenceAgainst: [],
      experimentIds: []
    };
    ledger.addHypothesis(baseHypothesis);
  });

  it('A hypothesis cannot become SUPPORTED solely because the model says so', () => {
    const ev: Evidence = {
      id: 'e1',
      hypothesisId: 'h1',
      sourceType: EvidenceSourceType.MODEL_CLAIM,
      source: 'investigator',
      content: 'I think this is true',
      supports: true,
      contradicts: false
    };
    ledger.addEvidence(ev);
    const status = ledger.evaluateHypothesisStatus('h1');
    expect(status).toBe(HypothesisStatus.INCONCLUSIVE);
  });

  it('A hypothesis becomes SUPPORTED with repository evidence', () => {
    const ev: Evidence = {
      id: 'e2',
      hypothesisId: 'h1',
      sourceType: EvidenceSourceType.COMMAND_OUTPUT,
      source: 'cat file.py',
      content: 'True',
      supports: true,
      contradicts: false
    };
    ledger.addEvidence(ev);
    const status = ledger.evaluateHypothesisStatus('h1');
    expect(status).toBe(HypothesisStatus.SUPPORTED);
  });

  it('Rejected hypotheses retain contradictory evidence', () => {
    const ev: Evidence = {
      id: 'e3',
      hypothesisId: 'h1',
      sourceType: EvidenceSourceType.COMMAND_OUTPUT,
      source: 'cat file.py',
      content: 'False',
      supports: false,
      contradicts: true
    };
    ledger.addEvidence(ev);
    const status = ledger.evaluateHypothesisStatus('h1');
    expect(status).toBe(HypothesisStatus.REJECTED);
    const hyp = ledger.getHypothesis('h1')!;
    expect(hyp.evidenceAgainst).toContain('e3');
  });
});
