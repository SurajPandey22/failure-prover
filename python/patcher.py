import json
from typing import Optional
from .domain import Diagnosis, FailureContext
from .llm import ILLMProvider

class Patcher:
    def __init__(self, llm: ILLMProvider):
        self.llm = llm

    def generate_patch(self, diagnosis: Diagnosis, context: FailureContext) -> Optional[str]:
        if diagnosis.confidence == "LOW":
            return None

        prompt = f"""
You are an expert software developer.
Based on the following root cause diagnosis, synthesize a unified git diff patch to fix the codebase.

Root Cause: {diagnosis.root_cause}
Failure Location: {context.failure_location}
Failure Reason: {context.failure_reason}
Experiments: {', '.join(diagnosis.experiments)}

Return ONLY the raw unified diff text (e.g. starting with --- a/file.py and +++ b/file.py).
Do not wrap in markdown or add explanations.
"""
        response = self.llm.generate(
            system_prompt="You generate clean unified git diffs to repair code bugs based on verified root causes.",
            user_prompt=prompt
        )

        cleaned = response.strip()
        if cleaned.startswith("```diff"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()
