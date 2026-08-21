import { FailureContext, Hypothesis, HypothesisStatus, Evidence } from './domain';
import { ILLMProvider } from './llm';

export class Verifier {
  constructor(private llm: ILLMProvider) {}

  async verify(
    hypothesis: Hypothesis,
    evidenceFor: Evidence[],
    evidenceAgainst: Evidence[],
    context: FailureContext
  ): Promise<HypothesisStatus> {
    const prompt = `
You are an independent Verifier.
Context:
${JSON.stringify(context, null, 2)}

Hypothesis: ${hypothesis.statement}

Evidence For:
${JSON.stringify(evidenceFor, null, 2)}

Evidence Against:
${JSON.stringify(evidenceAgainst, null, 2)}

Does the evidence objectively support the hypothesis?
Return JSON only:
{"status": "SUPPORTED" | "REJECTED" | "INCONCLUSIVE"}
`;

    const response = await this.llm.generate({
      systemPrompt: 'You independently verify evidence strictly based on facts.',
      userPrompt: prompt
    });

    try {
      const cleaned = response.trim().replace(/^```json/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.status === 'SUPPORTED') return HypothesisStatus.SUPPORTED;
      if (parsed.status === 'REJECTED') return HypothesisStatus.REJECTED;
      return HypothesisStatus.INCONCLUSIVE;
    } catch {
      return HypothesisStatus.INCONCLUSIVE;
    }
  }
}
