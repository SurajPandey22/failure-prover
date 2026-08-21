import { FakeLLM, GeminiLLM } from '../src/llm';

describe('LLM Boundary', () => {
  it('FakeLLM should return queued responses and record requests', async () => {
    const llm = new FakeLLM();
    llm.responses.push('Test hypothesis');
    
    const response = await llm.generate({
      systemPrompt: 'You are an investigator.',
      userPrompt: 'Analyze this log.'
    });

    expect(response).toBe('Test hypothesis');
    expect(llm.requests.length).toBe(1);
    expect(llm.requests[0].systemPrompt).toBe('You are an investigator.');
  });

  it('GeminiLLM should throw if API key is missing during generation', async () => {
    const originalEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    const llm = new GeminiLLM();
    await expect(llm.generate({
      systemPrompt: 'sys',
      userPrompt: 'user'
    })).rejects.toThrow('API Key is missing');

    if (originalEnv) process.env.GEMINI_API_KEY = originalEnv;
  });
});
