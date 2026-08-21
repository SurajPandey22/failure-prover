import * as crypto from 'crypto';

export interface LLMCallTrace {
  id: string;
  timestamp: string;
  promptName: string;
  promptVersion: string;
  promptHash: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

export interface SessionTrace {
  sessionId: string;
  timestamp: string;
  repoPath: string;
  totalLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  stepsCount: number;
  calls: LLMCallTrace[];
}

export class Observability {
  private static instance: Observability;
  private calls: LLMCallTrace[] = [];
  private sessions: SessionTrace[] = [];
  private currentSession: SessionTrace | null = null;

  // Prompt Templates with versioning
  private promptTemplates: Record<string, { version: string; template: string }> = {
    'HypothesisGenerator': {
      version: '1.2.0',
      template: 'Analyze pytest failure context and formulate 1 to 3 distinct hypotheses...'
    },
    'IndependentVerifier': {
      version: '1.1.0',
      template: 'Evaluate whether the repository evidence objectively supports or refutes...'
    },
    'Patcher': {
      version: '2.0.0',
      template: 'Based on the root cause diagnosis, synthesize a unified git diff patch...'
    }
  };

  private constructor() {}

  public static getInstance(): Observability {
    if (!Observability.instance) {
      Observability.instance = new Observability();
    }
    return Observability.instance;
  }

  public getPromptDetails(name: string) {
    const details = this.promptTemplates[name] || { version: '1.0.0', template: '' };
    const hash = crypto.createHash('md5').update(details.template).digest('hex').substring(0, 8);
    return {
      version: details.version,
      hash
    };
  }

  public startSession(sessionId: string, repoPath: string) {
    this.currentSession = {
      sessionId,
      timestamp: new Date().toISOString(),
      repoPath,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      stepsCount: 0,
      calls: []
    };
  }

  public endSession() {
    if (this.currentSession) {
      const end = Date.now();
      const start = new Date(this.currentSession.timestamp).getTime();
      this.currentSession.totalLatencyMs = end - start;
      this.currentSession.totalTokens = this.currentSession.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
      this.currentSession.totalCostUsd = this.currentSession.calls.reduce((sum, c) => sum + c.costUsd, 0);
      this.currentSession.stepsCount = this.currentSession.calls.length;
      
      this.sessions.push(this.currentSession);
      this.currentSession = null;
    }
  }

  public logCall(call: Omit<LLMCallTrace, 'id' | 'timestamp' | 'costUsd'>) {
    const inputCost = (call.inputTokens / 1_000_000) * 0.075;
    const outputCost = (call.outputTokens / 1_000_000) * 0.30;
    const costUsd = parseFloat((inputCost + outputCost).toFixed(8));

    const fullCall: LLMCallTrace = {
      ...call,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      costUsd
    };

    this.calls.push(fullCall);

    if (this.currentSession) {
      this.currentSession.calls.push(fullCall);
    }
  }

  public getSummary() {
    const totalCalls = this.calls.length;
    const totalSessions = this.sessions.length;
    const totalTokens = this.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
    const totalCostUsd = this.calls.reduce((sum, c) => sum + c.costUsd, 0);
    const averageLatencyMs = totalCalls > 0 ? this.calls.reduce((sum, c) => sum + c.latencyMs, 0) / totalCalls : 0;

    return {
      totalCalls,
      totalSessions,
      totalTokens,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
      averageLatencyMs: Math.round(averageLatencyMs),
      promptTemplates: Object.keys(this.promptTemplates).map(name => ({
        name,
        version: this.promptTemplates[name].version,
        hash: this.getPromptDetails(name).hash
      })),
      recentCalls: this.calls.slice(-10).reverse(),
      sessions: this.sessions.slice(-5).reverse()
    };
  }
}
