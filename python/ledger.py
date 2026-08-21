from typing import Dict, List, Optional
from .domain import Hypothesis, Evidence, HypothesisStatus

class Ledger:
    def __init__(self):
        self.hypotheses: Dict[str, Hypothesis] = {}
        self.evidence: Dict[str, Evidence] = {}

    def add_hypothesis(self, hyp: Hypothesis):
        self.hypotheses[hyp.id] = hyp

    def add_evidence(self, ev: Evidence):
        self.evidence[ev.id] = ev
        hyp = self.hypotheses.get(ev.hypothesis_id)
        if hyp:
            if ev.supports:
                hyp.evidence_for.append(ev.id)
            if ev.contradicts:
                hyp.evidence_against.append(ev.id)

    def get_hypothesis(self, hyp_id: str) -> Optional[Hypothesis]:
        return self.hypotheses.get(hyp_id)

    def get_all_hypotheses(self) -> List[Hypothesis]:
        return list(self.hypotheses.values())

    def get_all_evidence(self) -> List[Evidence]:
        return list(self.evidence.values())

    def evaluate_hypothesis_status(self, hyp_id: str) -> HypothesisStatus:
        hyp = self.hypotheses.get(hyp_id)
        if not hyp:
            return HypothesisStatus.PENDING

        ev_for = [self.evidence.get(eid) for eid in hyp.evidence_for if eid in self.evidence]
        ev_against = [self.evidence.get(eid) for eid in hyp.evidence_against if eid in self.evidence]

        # Rule: A hypothesis cannot become SUPPORTED solely because the model says so.
        # Evidence must come from the repository, logs, tests, command output, or git history.
        has_repo_evidence = any(e and e.source_type != "MODEL_CLAIM" and e.supports for e in ev_for)

        if ev_against:
            return HypothesisStatus.REJECTED

        if has_repo_evidence:
            return HypothesisStatus.SUPPORTED

        return HypothesisStatus.INCONCLUSIVE
