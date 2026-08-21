import json
from .domain import Hypothesis, Evidence, HypothesisStatus
from .llm import ILLMProvider

class IndependentVerifier:
    def __init__(self, llm: ILLMProvider):
        self.llm = llm

    def verify_evidence(self, hypothesis: Hypothesis, evidence: Evidence) -> HypothesisStatus:
        prompt = f"""
You are an independent, objective software verification judge.
Evaluate whether the following repository evidence objectively supports or refutes the hypothesis.

Hypothesis:
- Statement: {hypothesis.statement}
- Location: {hypothesis.likely_source_location}
- Reasoning: {hypothesis.reasoning}

Evidence Gathered from Repository:
- Command: {evidence.source}
- Output:
{evidence.content[:1500]}

Respond ONLY with a JSON object:
{{
  "status": "SUPPORTED" | "REJECTED" | "INCONCLUSIVE"
}}
"""
        response = self.llm.generate(
            system_prompt="You are an independent code verification judge. Respond strictly in JSON.",
            user_prompt=prompt
        )

        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            res = json.loads(cleaned)
            status_str = res.get("status", "INCONCLUSIVE").upper()
            if status_str in HypothesisStatus.__members__:
                return HypothesisStatus(status_str)
        except Exception:
            pass

        return HypothesisStatus.SUPPORTED if evidence.supports else HypothesisStatus.INCONCLUSIVE
