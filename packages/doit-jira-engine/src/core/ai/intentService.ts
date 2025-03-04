import { OpenAI } from 'openai';
import { SYSTEM_PROMPT } from '../../adapters/openai/prompts';
import { logger } from '../../utils/logger';

export function configureIntentService(openai: OpenAI) {
  async function determineIntent(text: string) {
    try {
      logger.info('Determining intent for text:', text);
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        temperature: 0.3,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Error determining intent:', error);
      throw error;
    }
  }
  
  return {
    determineIntent
  };
} 