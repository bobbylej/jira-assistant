import { OpenAIConfig } from '../../config/types';
import { createAIClient } from '../ai/client';
import { AIProvider } from '../ai/types';

export function createOpenAIClient(config: OpenAIConfig): AIProvider {
  return createAIClient(config.provider, {
    apiKey: config.apiKey,
  });
} 