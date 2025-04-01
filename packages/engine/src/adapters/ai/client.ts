import { AIModelConfig, AIProvider, AIProviderType } from './types';
import { configureOpenAIAdapter } from './openai.adapter';
import { configureGeminiAdapter } from './gemini.adapter';

export function createAIClient(providerType: AIProviderType, config: AIModelConfig): AIProvider {
  switch (providerType) {
    case 'openai':
      return configureOpenAIAdapter(config);
    case 'gemini':
      return configureGeminiAdapter(config);
    case 'anthropic':
      // return new AnthropicAdapter(config);
      throw new Error('Anthropic adapter not implemented yet');
    case 'ollama':
      // return new OllamaAdapter(config);
      throw new Error('Ollama adapter not implemented yet');
    default:
      throw new Error(`Unsupported AI provider: ${providerType}`);
  }
} 