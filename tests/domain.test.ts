import {
  FailureContext,
  Hypothesis,
  HypothesisStatus,
  ConfidenceLevel,
  Experiment,
  Evidence,
  EvidenceSourceType,
  Diagnosis
} from '../src/domain';

describe('Domain Objects', () => {
  it('should create a FailureContext correctly', () => {
    const ctx: FailureContext = {
      rawLog: 'AssertionError: expected 1 to be 2',
      errorType: 'AssertionError',
      errorMessage: 'expected 1 to be 2',
      stackTrace: 'at test_parser.py:10',
      testName: 'test_parser',
      sourceLocations: ['test_parser.py:10'],
      relevantLogLines: ['assert 1 == 2']
    };
    expect(ctx.errorType).toBe('AssertionError');
    expect(ctx.sourceLocations.length).toBe(1);
  });

  it('should create a Hypothesis correctly', () => {
    const hyp: Hypothesis = {
      id: 'h1',
      statement: 'The parser fails on non-numeric input',
      status: HypothesisStatus.PENDING,
      confidence: ConfidenceLevel.LOW,
      evidenceFor: [],
      evidenceAgainst: [],
      experimentIds: []
    };
    expect(hyp.status).toBe(HypothesisStatus.PENDING);
    expect(hyp.id).toBe('h1');
  });

  it('should create an Experiment correctly', () => {
    const exp: Experiment = {
      id: 'exp1',
      hypothesisId: 'h1',
      purpose: 'Check if parser uses int()',
      command: 'grep -n "int(" src/parser.ts'
    };
    expect(exp.hypothesisId).toBe('h1');
    expect(exp.exitCode).toBeUndefined();
  });

  it('should create an Evidence correctly', () => {
    const evidence: Evidence = {
      id: 'ev1',
      hypothesisId: 'h1',
      sourceType: EvidenceSourceType.FILE,
      source: 'src/parser.ts:15',
      content: 'const val = parseInt(header[2]);',
      supports: true,
      contradicts: false
    };
    expect(evidence.sourceType).toBe(EvidenceSourceType.FILE);
    expect(evidence.supports).toBe(true);
  });

  it('should create a Diagnosis correctly', () => {
    const diagnosis: Diagnosis = {
      rootCause: 'Parser assumes all header values are integers, which is false for AUTO.',
      supportingEvidence: ['ev1'],
      rejectedHypotheses: ['h2'],
      experiments: ['exp1'],
      confidence: ConfidenceLevel.HIGH,
      unresolvedQuestions: []
    };
    expect(diagnosis.confidence).toBe(ConfidenceLevel.HIGH);
    expect(diagnosis.supportingEvidence).toContain('ev1');
  });
});
