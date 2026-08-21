from datetime import datetime
from typing import List
from .domain import Diagnosis, Hypothesis, Evidence

class ReportGenerator:
    @staticmethod
    def generate_markdown(
        repo_path: str,
        diagnosis: Diagnosis,
        hypotheses: List[Hypothesis],
        evidence: List[Evidence]
    ) -> str:
        date = datetime.now().strftime("%Y-%m-%d")
        md = f"# AI Debugging Investigation Report\n\n"
        md += f"**Date:** {date}\n"
        md += f"**Target Repository:** `{repo_path}`\n\n"
        
        md += f"## 1. Executive Summary\n\n"
        md += f"**Root Cause:** {diagnosis.root_cause}\n\n"
        md += f"**Confidence:** {diagnosis.confidence}\n\n"

        if diagnosis.suggested_fix:
            md += f"## 2. Suggested Fix (Unified Diff)\n\n"
            md += "```diff\n"
            md += diagnosis.suggested_fix.strip() + "\n"
            md += "```\n\n"

        md += f"## 3. Evaluated Hypotheses\n\n"
        for idx, h in enumerate(hypotheses, 1):
            icon = "✅" if h.status == "SUPPORTED" else ("❌" if h.status == "REJECTED" else "⏳")
            md += f"### {idx}. {h.statement}\n"
            md += f"- **Status:** {icon} {h.status.value if hasattr(h.status, 'value') else h.status}\n"
            md += f"- **Location:** `{h.likely_source_location}`\n\n"

        md += f"## 4. Evidence Ledger\n\n"
        for e in evidence:
            md += f"**Command:** `{e.source}`\n"
            md += f"**Conclusion:** {'Supports' if e.supports else ('Contradicts' if e.contradicts else 'Neutral')}\n"
            md += "```text\n"
            md += e.content.strip()[:500] + ("\n... (truncated)" if len(e.content) > 500 else "") + "\n"
            md += "```\n\n"

        md += "---\n*Generated autonomously by Failure Prover (Python Engine)*\n"
        return md
