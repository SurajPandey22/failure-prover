export enum HypothesisStatus {
  PENDING = 'PENDING',
  SUPPORTED = 'SUPPORTED',
  REJECTED = 'REJECTED',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum ConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CERTAIN = 'CERTAIN'
}

export enum EvidenceSourceType {
  LOG = 'LOG',
  FILE = 'FILE',
  COMMAND_OUTPUT = 'COMMAND_OUTPUT',
  GIT_HISTORY = 'GIT_HISTORY',
  MODEL_CLAIM = 'MODEL_CLAIM'
}

export interface FailureContext {
  rawLog: string;
  errorType?: string;
  errorMessage?: string;
  stackTrace?: string;
  testName?: string;
  sourceLocations: string[];
  relevantLogLines: string[];
}

export interface Hypothesis {
  id: string;
  statement: string;
  status: HypothesisStatus;
  confidence: ConfidenceLevel;
  evidenceFor: string[];
  evidenceAgainst: string[];
  experimentIds: string[];
}

export interface Experiment {
  id: string;
  hypothesisId: string;
  purpose: string;
  command: string;
  output?: string;
  exitCode?: number;
  duration?: number;
}

export interface Evidence {
  id: string;
  hypothesisId: string;
  sourceType: EvidenceSourceType;
  source: string;
  content: string;
  experimentId?: string;
  supports: boolean;
  contradicts: boolean;
}

export interface Diagnosis {
  rootCause: string;
  supportingEvidence: string[];
  rejectedHypotheses: string[];
  experiments: string[];
  confidence: ConfidenceLevel;
  unresolvedQuestions: string[];
}
