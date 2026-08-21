from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any

class HypothesisStatus(str, Enum):
    PENDING = "PENDING"
    SUPPORTED = "SUPPORTED"
    REJECTED = "REJECTED"
    INCONCLUSIVE = "INCONCLUSIVE"

@dataclass
class FailureContext:
    raw_log: str
    failed_tests: List[str] = field(default_factory=list)
    failure_location: Optional[str] = None
    failure_reason: Optional[str] = None
    stack_trace: List[str] = field(default_factory=list)

@dataclass
class Hypothesis:
    id: str
    statement: str
    likely_source_location: str
    reasoning: str
    proposed_experiment: str
    status: HypothesisStatus = HypothesisStatus.PENDING
    evidence_for: List[str] = field(default_factory=list)
    evidence_against: List[str] = field(default_factory=list)

@dataclass
class Evidence:
    id: str
    hypothesis_id: str
    source_type: str # "FILE_READ", "SEARCH", "TEST_OUTPUT", "GIT_DIFF", "MODEL_CLAIM"
    source: str
    content: str
    supports: bool
    contradicts: bool
    reasoning: str

@dataclass
class Diagnosis:
    root_cause: str
    confidence: str # "HIGH", "MEDIUM", "LOW"
    experiments: List[str] = field(default_factory=list)
    suggested_fix: Optional[str] = None
