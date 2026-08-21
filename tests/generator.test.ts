import { HypothesisGenerator } from '../src/generator';
import { FakeLLM } from '../src/llm';
import { FailureContext } from '../src/domain';

describe('HypothesisGenerator', () => {
  let llm: FakeLLM;
  let generator: HypothesisGenerator;
  let context: FailureContext;

  beforeEach(() => {
    llm = new FakeLLM();
    generator = new HypothesisGenerator(llm);
    context = {
      rawLog: 'Error',
      sourceLocations: [],
      relevantLogLines: []
    };
  });

  it('should parse well-formed LLM output into domain objects', async () => {
    llm.responses.push(`
      [
        {
          "statement": "The parser expects numeric data",
          "likelySourceLocation": "parser.ts:10",
          "reasoning": "Exception at line 10",
          "proposedExperiment": "cat parser.ts"
        }
      ]
    `);

    const hypotheses = await generator.generate(context);
    expect(hypotheses.length).toBe(1);
    expect(hypotheses[0].statement).toBe('The parser expects numeric data');
    expect(hypotheses[0].status).toBe('PENDING');
  });

  it('should handle malformed JSON gracefully', async () => {
    llm.responses.push(`Here is a hypothesis: not json`);

    const hypotheses = await generator.generate(context);
    expect(hypotheses.length).toBe(1);
    expect(hypotheses[0].statement).toBe('Could not parse hypotheses from LLM output.');
    expect(hypotheses[0].status).toBe('PENDING');
  });

  it('should handle JSON with markdown code blocks', async () => {
    llm.responses.push(`
    \`\`\`json
    [
      { "statement": "Markdown block works" }
    ]
    \`\`\`
    `);

    const hypotheses = await generator.generate(context);
    expect(hypotheses.length).toBe(1);
    expect(hypotheses[0].statement).toBe('Markdown block works');
  });
});
