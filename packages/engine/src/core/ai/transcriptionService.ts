import { AIProvider } from '../../adapters/ai/types';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export function configureTranscriptionService(aiClient: AIProvider, config: any) {
  async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      logger.info('Transcribing audio...');
      
      // Save buffer to temporary file
      const tempFilePath = path.join(config.tempDir || '/tmp', `recording-${Date.now()}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Transcribe using AI provider
      const transcription = await aiClient.transcribeAudio(
        { 
          path: tempFilePath,
          type: 'audio/wav'
        }
      );
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      logger.info('Transcription result:', transcription.text);
      return transcription.text;
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      throw error;
    }
  }
  
  return {
    transcribeAudio
  };
} 