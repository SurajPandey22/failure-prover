import * as fs from 'fs';
import * as path from 'path';
import { Diagnosis, Hypothesis, Evidence } from './domain';

export class ReportGenerator {
  public static generateMarkdown(
    repoPath: string,
    diagnosis: Diagnosis,
    hypotheses: Hypothesis[],
    evidence: Evidence[]
  ): string {
    const date = new Date().toISOString().split('T')[0];
    
    let md = `# AI Debugging Investigation Report\n\n`;
    md += `**Date:** ${date}\n`;
    md += `**Target Repository:** \`${repoPath}\`\n\n`;
    
    md += `## 1. Executive Summary\n\n`;
    md += `**Root Cause:** ${diagnosis.rootCause}\n\n`;
    md += `**Confidence:** ${diagnosis.confidence}\n\n`;
    
    if (diagnosis.suggestedFix) {
      md += `## 2. Suggested Fix\n\n`;
      md += '```diff\n';
      md += diagnosis.suggestedFix.trim() + '\n';
      md += '```\n\n';
    }
    
    md += `## 3. Evaluated Hypotheses\n\n`;
    hypotheses.forEach((h, index) => {
      const statusIcon = h.status === 'SUPPORTED' ? '✅' : (h.status === 'REJECTED' ? '❌' : '⏳');
      md += `### ${index + 1}. ${h.statement}\n`;
      md += `- **Status:** ${statusIcon} ${h.status}\n\n`;
    });
    
    md += `## 4. Evidence Ledger\n\n`;
    md += `The following evidence was collected by the agent autonomously by running terminal commands:\n\n`;
    evidence.forEach(e => {
      md += `**Command:** \`${e.source}\`\n`;
      md += `**Conclusion:** ${e.supports ? 'Supports' : (e.contradicts ? 'Contradicts' : 'Neutral')}\n`;
      md += '```text\n';
      md += e.content.trim().substring(0, 500) + (e.content.length > 500 ? '\n... (truncated)' : '') + '\n';
      md += '```\n\n';
    });
    
    md += `---\n*Generated autonomously by Failure Prover*\n`;
    
    return md;
  }
}
