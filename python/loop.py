import json
from typing import Callable, Optional
from .domain import FailureContext, Diagnosis, Evidence, HypothesisStatus
from .llm import ILLMProvider
from .execution import ExperimentRunner
from .ledger import Ledger
from .generator import HypothesisGenerator
from .verifier import IndependentVerifier
from .patcher import Patcher

ProgressCallback = Callable[[str], None]

class InvestigationLoop:
    def __init__(
        self,
        llm: ILLMProvider,
        runner: ExperimentRunner,
        ledger: Ledger,
        on_progress: Optional[ProgressCallback] = None
    ):
        self.llm = llm
        self.runner = runner
        self.ledger = ledger
        self.on_progress = on_progress
        self.generator = HypothesisGenerator(llm)
        self.verifier = IndependentVerifier(llm)
        self.patcher = Patcher(llm)

    def _emit(self, msg: str):
        if self.on_progress:
            self.on_progress(msg)

    def run(self, context: FailureContext) -> Diagnosis:
        self._emit("Generating initial hypotheses from failure context...")
        hypotheses = self.generator.generate_hypotheses(context)

        for h in hypotheses:
            self.ledger.add_hypothesis(h)
            self._emit(f"-> Hypothesis created: {h.statement[:65]}...")

        successful_hypothesis = None
        experiments_run = []

        for step, h in enumerate(hypotheses, 1):
            self._emit(f"\n[Step {step}] Investigating: {h.statement[:65]}...")
            command = h.proposed_experiment
            experiments_run.append(command)

            self._emit(f"-> Running experiment: {command}")
            result = self.runner.run_experiment(command)

            if not result.get("success", False):
                self._emit(f"-> Experiment failed: {result.get('output', '')}")
                continue

            output = result.get("output", "")
            self._emit("-> Evaluating experiment evidence...")

            # Analyze evidence with LLM
            eval_prompt = f"""
Analyze this command output to see if it supports or contradicts the hypothesis.

Hypothesis: {h.statement}
Command: {command}
Output:
{output[:1500]}

Respond ONLY in JSON:
{{
  "supports": boolean,
  "contradicts": boolean,
  "reason": string
}}
"""
            eval_resp = self.llm.generate(
                system_prompt="Analyze code evidence objectively. Respond in JSON.",
                user_prompt=eval_prompt
            )

            supports = False
            contradicts = False
            reason = "Analyzed output"

            try:
                cleaned = eval_resp.strip().replace("```json", "").replace("```", "").strip()
                parsed = json.loads(cleaned)
                supports = bool(parsed.get("supports", False))
                contradicts = bool(parsed.get("contradicts", False))
                reason = parsed.get("reason", "")
            except Exception:
                supports = True

            ev = Evidence(
                id=f"ev_{step}",
                hypothesis_id=h.id,
                source_type="FILE_READ" if "read file" in command or "cat" in command else "TEST_OUTPUT",
                source=command,
                content=output[:1000],
                supports=supports,
                contradicts=contradicts,
                reasoning=reason
            )
            self.ledger.add_evidence(ev)

            status = self.ledger.evaluate_hypothesis_status(h.id)
            if status == HypothesisStatus.SUPPORTED:
                self._emit("-> Hypothesis conditionally supported. Handing to Independent Verifier...")
                verdict = self.verifier.verify_evidence(h, ev)
                h.status = verdict
                self._emit(f"-> Verifier verdict: {verdict.value}")

                if verdict == HypothesisStatus.SUPPORTED:
                    successful_hypothesis = h
                    break
            else:
                h.status = status
                self._emit(f"-> Ledger evaluated status: {status.value}")

        self._emit(f"\nInvestigation Complete. Root cause found: {'YES' if successful_hypothesis else 'NO'}")

        if successful_hypothesis:
            diag = Diagnosis(
                root_cause=successful_hypothesis.statement,
                confidence="HIGH",
                experiments=experiments_run
            )
        else:
            diag = Diagnosis(
                root_cause="Inconclusive: multiple hypotheses refuted or insufficient repository evidence.",
                confidence="LOW",
                experiments=experiments_run
            )

        if diag.confidence != "LOW":
            self._emit("Synthesizing unified repair patch...")
            diag.suggested_fix = self.patcher.generate_patch(diag, context)

        return diag
