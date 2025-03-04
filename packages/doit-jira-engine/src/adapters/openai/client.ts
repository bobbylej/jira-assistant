import { OpenAI } from 'openai';
import { OpenAIConfig } from '../../config/types';

export function createOpenAIClient(config: OpenAIConfig) {
  const client = new OpenAI({
    apiKey: config.apiKey
  });
  
  return client;
} 