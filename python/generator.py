import json
from typing import List
from .domain import FailureContext, Hypothesis, HypothesisStatus
from .llm import ILLMProvider

class HypothesisGenerator:
    def __init__(self, llm: ILLMProvider):
        self.llm = llm

    def generate_hypotheses(self, context: FailureContext) -> List[Hypothesis]:
        prompt = f"""
You are an expert software investigator debugging a test failure.
Analyze the following pytest failure context and formulate 1 to 3 distinct hypotheses about the root cause.

Failure Context:
- Failed Tests: {', '.join(context.failed_tests)}
- Likely Location: {context.failure_location}
- Failure Reason: {context.failure_reason}
- Stack Trace:
{chr(10).join(context.stack_trace[:15])}

Return a valid JSON array of objects with the following keys:
- "statement": Clear description of what is broken
- "likelySourceLocation": Specific file and line number (e.g. "parser.py:8")
- "reasoning": Why this failure occurs
- "proposedExperiment": Command to verify or refute (e.g. "read file parser.py" or "search parse_header")

Return ONLY the JSON array.
"""
        response = self.llm.generate(
            system_prompt="You are a root cause hypothesis generator. Respond in strict JSON.",
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
            items = json.loads(cleaned)
            hypotheses = []
            for idx, item in enumerate(items):
                hypotheses.append(Hypothesis(
                    id=f"hyp_{idx + 1}",
                    statement=item.get("statement", "Unknown statement"),
                    likely_source_location=item.get("likelySourceLocation", "unknown:0"),
                    reasoning=item.get("reasoning", ""),
                    proposed_experiment=item.get("proposedExperiment", "read file main.py"),
                    status=HypothesisStatus.PENDING
                ))
            return hypotheses
        except Exception:
            return [
                Hypothesis(
                    id="hyp_fallback",
                    statement=f"Potential defect near {context.failure_location}: {context.failure_reason}",
                    likely_source_location=context.failure_location or "unknown:0",
                    reasoning="Extracted directly from pytest failure trace",
                    proposed_experiment=f"read file {context.failure_location.split(':')[0] if context.failure_location else 'main.py'}",
                    status=HypothesisStatus.PENDING
                )
            ]
