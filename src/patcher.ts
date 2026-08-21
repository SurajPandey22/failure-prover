import { FailureContext, Diagnosis, HypothesisStatus } from './domain';
import { ILLMProvider } from './llm';

export class Patcher {
  constructor(private llm: ILLMProvider) {}

  async generatePatch(diagnosis: Diagnosis, context: FailureContext): Promise<string | null> {
    if (diagnosis.confidence === 'LOW') {
      return null;
    }

    const prompt = `
You are an expert developer.
Based on the following diagnosis of a bug, generate a unified diff (git diff) to fix the codebase.
Return ONLY the raw unified diff text. Do not include markdown blocks or any other explanation.

Root Cause: ${diagnosis.rootCause}
Experiments Run: ${diagnosis.experiments.join(', ')}

Original Failure Context:
${JSON.stringify(context, null, 2)}
`;

    const response = await this.llm.generate({
      systemPrompt: 'You generate raw unified diffs to fix code based on proven root causes.',
      userPrompt: prompt,
      promptName: 'Patcher'
    });

    try {
      const cleaned = response.trim().replace(/^```diff/, '').replace(/^```/, '').replace(/```$/, '').trim();
      return cleaned;
    } catch {
      return null;
    }
  }
}
