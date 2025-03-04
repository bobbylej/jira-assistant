import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Export a configuration function instead of initializing OpenAI directly
export function configureTranscriptionService(apiKey: string) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });

  /**
   * Transcribes audio to text using OpenAI's Whisper API
   * @param {Buffer} audioBuffer - The audio buffer to transcribe
   * @returns {Promise<string>} - The transcribed text
   */
  async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      console.log('Transcription service received audio buffer of size:', audioBuffer.length);
      
      // Create a temporary file from the buffer
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `recording-${Date.now()}.wav`);
      
      console.log('Writing audio buffer to temporary file:', tempFilePath);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      console.log('Sending file to OpenAI Whisper API');
      // Use the file for transcription
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1'
      });
      
      console.log('Received transcription:', response.text);
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      console.log('Temporary file deleted');
      
      return response.text;
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  return {
    transcribeAudio
  };
} 