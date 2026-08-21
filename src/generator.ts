import { FailureContext, Hypothesis, HypothesisStatus, ConfidenceLevel } from './domain';
import { ILLMProvider } from './llm';

export class HypothesisGenerator {
  constructor(private llm: ILLMProvider) {}

  async generate(context: FailureContext): Promise<Hypothesis[]> {
    const systemPrompt = `You are an expert software investigator debugging a failure.
Analyze the provided test failure context and propose 2 to 4 distinct hypotheses for the root cause.
Return ONLY a JSON array of objects with this format:
[
  {
    "statement": "The hypothesis statement",
    "likelySourceLocation": "file:line",
    "reasoning": "Why you believe this",
    "proposedExperiment": "Command or action to test this"
  }
]
Do not include markdown blocks or any other text.`;

    const userPrompt = JSON.stringify(context, null, 2);

    const responseText = await this.llm.generate({ systemPrompt, userPrompt });

    try {
      let cleaned = responseText.trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        cleaned = match[0];
      }
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('LLM did not return an array of hypotheses');
      }

      return parsed.map((item: any, index: number) => {
        // Validate and convert to domain object
        return {
          id: `hyp-${Date.now()}-${index}`,
          statement: typeof item.statement === 'string' ? item.statement : 'Unknown statement',
          status: HypothesisStatus.PENDING,
          confidence: ConfidenceLevel.LOW,
          evidenceFor: [],
          evidenceAgainst: [],
          experimentIds: [] 
        };
      });
    } catch (e) {
      return [
        {
          id: `hyp-fallback-${Date.now()}`,
          statement: 'Could not parse hypotheses from LLM output.',
          status: HypothesisStatus.PENDING,
          confidence: ConfidenceLevel.LOW,
          evidenceFor: [],
          evidenceAgainst: [],
          experimentIds: []
        }
      ];
    }
  }
}
