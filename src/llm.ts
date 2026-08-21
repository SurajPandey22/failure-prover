export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface ILLMProvider {
  generate(request: LLMRequest): Promise<string>;
}

export class FakeLLM implements ILLMProvider {
  public responses: string[] = [];
  public requests: LLMRequest[] = [];

  async generate(request: LLMRequest): Promise<string> {
    this.requests.push(request);
    const response = this.responses.shift() || 'Default fake response';
    return response;
  }
}

export class GeminiLLM implements ILLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey && process.env.NODE_ENV !== 'test') {
      console.warn('GEMINI_API_KEY environment variable is not set.');
    }
  }

  async generate(request: LLMRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API Key is missing');
    }
    // Minimal mock-like implementation for actual API call, avoiding heavy SDK for now
    // In real app, we'd use fetch or @google/genai
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}
