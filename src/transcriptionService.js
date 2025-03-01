const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribes audio using OpenAI's Whisper API
 * @param {Buffer} audioBuffer - The audio buffer to transcribe
 * @returns {Promise<string>} - The transcribed text
 */
async function transcribeAudio(audioBuffer) {
    try {
        // Create a temporary file from the buffer
        const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.wav`);
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // Send to OpenAI for transcription
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "en"
        });
        
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
        
        return transcription.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw new Error('Failed to transcribe audio');
    }
}

module.exports = {
    transcribeAudio
}; 