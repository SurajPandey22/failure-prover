import { FailureContext, Hypothesis, HypothesisStatus, ConfidenceLevel, Evidence, EvidenceSourceType, Diagnosis } from './domain';
import { ILLMProvider } from './llm';
import { ExperimentRunner } from './execution';
import { HypothesisGenerator } from './generator';
import { Ledger } from './ledger';
import { Verifier } from './verifier';

export class InvestigationLoop {
  constructor(
    private llm: ILLMProvider,
    private runner: ExperimentRunner,
    private ledger: Ledger
  ) {}

  async run(context: FailureContext): Promise<Diagnosis> {
    const generator = new HypothesisGenerator(this.llm);
    const verifier = new Verifier(this.llm);
    let hypotheses = await generator.generate(context);
    
    // Save to ledger
    for (const h of hypotheses) {
      this.ledger.addHypothesis(h);
    }

    let loopCount = 0;
    
    // Main Investigation Loop
    while (loopCount < 8) { // max steps
      loopCount++;
      const pendingHypothesis = this.ledger.getAllHypotheses().find(h => h.status === HypothesisStatus.PENDING);
      
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
      let evalResultStr = await this.llm.generate({ systemPrompt: 'You evaluate evidence strictly.', userPrompt: evalPrompt });
      
      let supports = false;
      let contradicts = false;
      try {
        const cleaned = evalResultStr.trim().replace(/^```json/, '').replace(/```$/, '').trim();
        const evEval = JSON.parse(cleaned);
        supports = evEval.supports;
        contradicts = evEval.contradicts;
      } catch (e) {}

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

      this.ledger.addEvidence(evidence);

      // 4. Update hypothesis state logically using the ledger
      pendingHypothesis.status = this.ledger.evaluateHypothesisStatus(pendingHypothesis.id);
      
      // Phase 8: Independent Verification if supported by investigator
      if (pendingHypothesis.status === HypothesisStatus.SUPPORTED) {
        const evFor = pendingHypothesis.evidenceFor.map(id => this.ledger.getEvidence(id)!);
        const evAgainst = pendingHypothesis.evidenceAgainst.map(id => this.ledger.getEvidence(id)!);
        const verifiedStatus = await verifier.verify(pendingHypothesis, evFor, evAgainst, context);
        pendingHypothesis.status = verifiedStatus; // Upgrade or downgrade based on verifier
      }
    }

    const allHyp = this.ledger.getAllHypotheses();
    const supported = allHyp.find(h => h.status === HypothesisStatus.SUPPORTED);
    return {
      rootCause: supported ? supported.statement : 'Unknown',
      supportingEvidence: supported ? supported.evidenceFor : [],
      rejectedHypotheses: allHyp.filter(h => h.status === HypothesisStatus.REJECTED).map(h => h.id),
      experiments: this.runner.getRecords().map(r => r.command),
      confidence: supported ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
      unresolvedQuestions: []
    };
  }
}
