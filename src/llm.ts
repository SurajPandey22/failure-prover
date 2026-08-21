import { GoogleGenAI } from '@google/genai';

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
  private ai: GoogleGenAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey && process.env.NODE_ENV !== 'test') {
      console.warn('GEMINI_API_KEY environment variable is not set.');
    }
    
    // Initialize the official Google GenAI SDK
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generate(request: LLMRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API Key is missing');
    }
    const MAX_RETRIES = 4;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: request.userPrompt,
          config: {
            systemInstruction: request.systemPrompt,
          }
        });
        return response.text || '';
      } catch (e: any) {
        lastError = new Error(`LLM API Error: ${e.message}`);
        const isRetryable = e.message?.includes('503') || 
                            e.message?.includes('UNAVAILABLE') || 
                            e.message?.includes('overloaded') || 
                            e.message?.includes('429') || 
                            e.message?.includes('RESOURCE_EXHAUSTED') || 
                            e.message?.includes('quota');
        if (isRetryable && attempt < MAX_RETRIES) {
          // If quota exceeded, wait a bit longer to reset the RPM bucket (e.g. 15s, 30s)
          const isQuota = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED');
          const waitMs = isQuota ? Math.max(15000, 10000 * attempt) : (2000 * Math.pow(2, attempt - 1));
          console.warn(`[LLM] Rate limit or service busy. Pausing ${waitMs / 1000}s before retry... (attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          break;
        }
      }
    }
    throw lastError;
  }
}
