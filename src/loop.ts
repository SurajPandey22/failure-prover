import { FailureContext, Hypothesis, HypothesisStatus, ConfidenceLevel, Evidence, EvidenceSourceType, Diagnosis, ProgressCallback } from './domain';
import { ILLMProvider } from './llm';
import { ExperimentRunner } from './execution';
import { HypothesisGenerator } from './generator';
import { Ledger } from './ledger';
import { Verifier } from './verifier';
import { Patcher } from './patcher';
import { Observability } from './observability';

export class InvestigationLoop {
  constructor(
    private llm: ILLMProvider,
    private runner: ExperimentRunner,
    private ledger: Ledger,
    private onProgress?: ProgressCallback
  ) {}

  private emit(msg: string) {
    if (this.onProgress) this.onProgress(msg);
  }

  async run(context: FailureContext): Promise<Diagnosis> {
    const obs = Observability.getInstance();
    const sessionId = `session-${Date.now()}`;
    obs.startSession(sessionId, this.runner.getTargetRepoPath());

    const generator = new HypothesisGenerator(this.llm);
    const verifier = new Verifier(this.llm);
    const patcher = new Patcher(this.llm);
    
    this.emit('Generating initial hypotheses from failure context...');
    let hypotheses = await generator.generate(context);
    
    for (const h of hypotheses) {
      this.ledger.addHypothesis(h);
      this.emit(`-> Hypothesis created: ${h.statement.substring(0, 50)}...`);
    }

    let loopCount = 0;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    
    while (loopCount < 8) { 
      loopCount++;
      const pendingHypothesis = this.ledger.getAllHypotheses().find(h => h.status === HypothesisStatus.PENDING);
      
      if (!pendingHypothesis) break;

      this.emit(`\n[Step {loopCount}] Investigating: ${pendingHypothesis.statement.substring(0, 50)}...`);
      const prompt = `Hypothesis: ${pendingHypothesis.statement}\nContext: ${JSON.stringify(context)}\nPropose next experiment command. Options: read file <path>, search files <query>, run pytest, inspect git diff. Return ONLY the command string.`;
      
      if (process.env.NODE_ENV !== 'test') {
        this.emit('Spacing request to respect Gemini rate limits...');
        await sleep(7000);
      }

      let command = await this.llm.generate({ 
        systemPrompt: 'You are an investigator.', 
        userPrompt: prompt,
        promptName: 'AgentOrchestrator_NextCmd'
      });
      command = command.trim().replace(/^`+|`+$/g, '');

      if (!command) {
        pendingHypothesis.status = HypothesisStatus.INCONCLUSIVE;
        continue;
      }

      this.emit(`-> Running experiment: ${command}`);
      let result;
      try {
        result = await this.runner.runOperation(command);
      } catch (e: any) {
        this.emit(`-> Experiment failed: ${e.message}`);
        pendingHypothesis.status = HypothesisStatus.INCONCLUSIVE;
        continue; 
      }

      this.emit(`-> Evaluating experiment evidence...`);
      const evalPrompt = `Command: ${command}\nOutput: ${result.output}\nDoes this support or contradict the hypothesis: "${pendingHypothesis.statement}"? Return JSON: {"supports": true/false, "contradicts": true/false, "reason": "..."}`;
      
      if (process.env.NODE_ENV !== 'test') {
        await sleep(7000);
      }

      let evalResultStr = await this.llm.generate({ 
        systemPrompt: 'You evaluate evidence strictly.', 
        userPrompt: evalPrompt,
        promptName: 'AgentOrchestrator_EvalEvidence'
      });
      
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
      pendingHypothesis.status = this.ledger.evaluateHypothesisStatus(pendingHypothesis.id);
      
      if (pendingHypothesis.status === HypothesisStatus.SUPPORTED) {
        this.emit(`-> Hypothesis conditionally supported. Handing to Independent Verifier...`);
        const evFor = pendingHypothesis.evidenceFor.map(id => this.ledger.getEvidence(id)!);
        const evAgainst = pendingHypothesis.evidenceAgainst.map(id => this.ledger.getEvidence(id)!);
        if (process.env.NODE_ENV !== 'test') await sleep(7000);
        const verifiedStatus = await verifier.verify(pendingHypothesis, evFor, evAgainst, context);
        pendingHypothesis.status = verifiedStatus;
        this.emit(`-> Verifier verdict: ${verifiedStatus}`);
      }
    }

    const allHyp = this.ledger.getAllHypotheses();
    const supported = allHyp.find(h => h.status === HypothesisStatus.SUPPORTED);
    
    this.emit(`\nInvestigation Complete. Root cause found: ${supported ? 'YES' : 'NO'}`);
    
    const diagnosis: Diagnosis = {
      rootCause: supported ? supported.statement : 'Unknown',
      supportingEvidence: supported ? supported.evidenceFor : [],
      rejectedHypotheses: allHyp.filter(h => h.status === HypothesisStatus.REJECTED).map(h => h.id),
      experiments: this.runner.getRecords().map(r => r.command),
      confidence: supported ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
      unresolvedQuestions: []
    };

    if (supported) {
      if (process.env.NODE_ENV !== 'test') await sleep(7000);
      const fix = await patcher.generatePatch(diagnosis, context);
      if (fix) diagnosis.suggestedFix = fix;
    }

    obs.endSession();
    return diagnosis;
  }
}
