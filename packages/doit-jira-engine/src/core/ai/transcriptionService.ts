import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export function configureTranscriptionService(openai: OpenAI, config: any) {
  async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      logger.info('Transcribing audio...');
      
      // Save buffer to temporary file
      const tempFilePath = path.join(config.tempDir || '/tmp', `recording-${Date.now()}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Transcribe using OpenAI
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
      });
      
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