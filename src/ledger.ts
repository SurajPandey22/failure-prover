import { Evidence, Hypothesis, HypothesisStatus } from './domain';

export class Ledger {
  private hypotheses: Map<string, Hypothesis> = new Map();
  private evidence: Map<string, Evidence> = new Map();

  addHypothesis(hypothesis: Hypothesis) {
    this.hypotheses.set(hypothesis.id, hypothesis);
  }

  addEvidence(evidence: Evidence) {
    this.evidence.set(evidence.id, evidence);
    const hyp = this.hypotheses.get(evidence.hypothesisId);
    if (hyp) {
      if (evidence.supports) {
        hyp.evidenceFor.push(evidence.id);
      }
      if (evidence.contradicts) {
        hyp.evidenceAgainst.push(evidence.id);
      }
    }
  }

  getHypothesis(id: string) {
    return this.hypotheses.get(id);
  }

  getAllHypotheses() {
    return Array.from(this.hypotheses.values());
  }

  getEvidence(id: string) {
    return this.evidence.get(id);
  }

  getAllEvidence() {
    return Array.from(this.evidence.values());
  }

  evaluateHypothesisStatus(id: string): HypothesisStatus {
    const hyp = this.hypotheses.get(id);
    if (!hyp) return HypothesisStatus.PENDING; // Should not happen in real usage

    const evFor = hyp.evidenceFor.map(eid => this.evidence.get(eid));
    const evAgainst = hyp.evidenceAgainst.map(eid => this.evidence.get(eid));

    const hasRepositoryEvidence = evFor.some(e => e && e.sourceType !== 'MODEL_CLAIM' && e.supports);
    
    // "A hypothesis cannot become SUPPORTED solely because the model says so."
    if (evAgainst.length > 0) {
      return HypothesisStatus.REJECTED; // Contradictory evidence rejects it
    }
    
    if (hasRepositoryEvidence) {
      return HypothesisStatus.SUPPORTED;
    }
    
    return HypothesisStatus.INCONCLUSIVE;
  }
}
