import { FailureContext, Hypothesis, HypothesisStatus, ConfidenceLevel, Evidence, EvidenceSourceType, Diagnosis } from './domain';
import { ILLMProvider } from './llm';
import { ExperimentRunner } from './execution';
import { HypothesisGenerator } from './generator';


export class InvestigationLoop {
  constructor(
    private llm: ILLMProvider,
    private runner: ExperimentRunner,
    private ledger: any // To be replaced with real Ledger later
  ) {}

  async run(context: FailureContext): Promise<Diagnosis> {
    const generator = new HypothesisGenerator(this.llm);
    let hypotheses = await generator.generate(context);
    
    // Save to ledger (mock for now)
    if (this.ledger && this.ledger.addHypotheses) {
      this.ledger.addHypotheses(hypotheses);
    }

    let loopCount = 0;
    
    // Main Investigation Loop
    while (loopCount < 8) { // max steps
      loopCount++;
      const pendingHypothesis = hypotheses.find(h => h.status === HypothesisStatus.PENDING);
      
      if (!pendingHypothesis) {
        break; // All hypotheses evaluated
      }

      // 1. Choose experiment
      const prompt = `Hypothesis: ${pendingHypothesis.statement}\nContext: ${JSON.stringify(context)}\nPropose next experiment command. Options: read file <path>, search files <query>, run pytest, inspect git diff. Return ONLY the command string.`;
      let command = await this.llm.generate({ systemPrompt: 'You are an investigator.', userPrompt: prompt });
      command = command.trim().replace(/^`+|`+$/g, '');

      if (!command) {
        pendingHypothesis.status = HypothesisStatus.INCONCLUSIVE;
        continue;
      }

      // 2. Execute experiment
      let result;
      try {
        result = await this.runner.runOperation(command);
      } catch (e: any) {
        pendingHypothesis.status = HypothesisStatus.INCONCLUSIVE;
        continue; // e.g., timeout or max steps
      }

      // 3. Observe result & Create Evidence
      const evalPrompt = `Command: ${command}\nOutput: ${result.output}\nDoes this support or contradict the hypothesis: "${pendingHypothesis.statement}"? Return JSON: {"supports": true/false, "contradicts": true/false, "reason": "..."}`;
      let evalResultStr = await this.llm.generate({ systemPrompt: 'You evaluate evidence.', userPrompt: evalPrompt });
      
      let supports = false;
      let contradicts = false;
      try {
        const cleaned = evalResultStr.trim().replace(/^```json/, '').replace(/```$/, '').trim();
        const evEval = JSON.parse(cleaned);
        supports = evEval.supports;
        contradicts = evEval.contradicts;
      } catch (e) {
        // Fallback
      }

      const evidence: Evidence = {
        id: `ev-${Date.now()}-${loopCount}`,
        hypothesisId: pendingHypothesis.id,
        sourceType: EvidenceSourceType.COMMAND_OUTPUT,
        source: command,
        content: result.output.substring(0, 200),
        experimentId: `exp-${Date.now()}`,
        supports,
        contradicts
      };

      if (this.ledger && this.ledger.addEvidence) {
        this.ledger.addEvidence(evidence);
      }

      pendingHypothesis.evidenceFor.push(evidence.id);

      // 4. Update hypothesis state
      if (supports && !contradicts) {
        pendingHypothesis.status = HypothesisStatus.SUPPORTED;
      } else if (contradicts) {
        pendingHypothesis.status = HypothesisStatus.REJECTED;
      } else {
        pendingHypothesis.status = HypothesisStatus.INCONCLUSIVE;
      }
    }

    const supported = hypotheses.find(h => h.status === HypothesisStatus.SUPPORTED);
    return {
      rootCause: supported ? supported.statement : 'Unknown',
      supportingEvidence: supported ? supported.evidenceFor : [],
      rejectedHypotheses: hypotheses.filter(h => h.status === HypothesisStatus.REJECTED).map(h => h.id),
      experiments: this.runner.getRecords().map(r => r.command),
      confidence: supported ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
      unresolvedQuestions: []
    };
  }
}
