import { OpenAI } from "openai";
import {
  AIModelConfig,
  AIProvider,
  AICompletionParams,
  AICompletionResponse,
  AITranscriptionResponse,
  StructuredOutputConfig,
} from "./types";

import fs from 'fs';

export function configureOpenAIAdapter(config: AIModelConfig): AIProvider {
  const client = new OpenAI({
    apiKey: config.apiKey,
  });

  function convertStructuredOutputToOpenAIConfig(
    config: StructuredOutputConfig
  ): { response_format: { type: 'json_object' } } | undefined {
    if (!config) return undefined;
    return { response_format: { type: 'json_object' } };
  }

  async function createChatCompletion(
    params: AICompletionParams
  ): Promise<AICompletionResponse> {
    const structuredOutput = params.structuredOutput ? convertStructuredOutputToOpenAIConfig(params.structuredOutput) : undefined;
    
    const response = await client.chat.completions.create({
      model: params.model || "gpt-4-turbo",
      tool_choice: params.tool_choice || "auto",
      ...params,
      ...structuredOutput,
    });
    return response;
  }

  async function transcribeAudio(
    audioFile: {
      path: string;
      type: string;
    },
    options: { model?: string } = {}
  ): Promise<AITranscriptionResponse> {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.path),
      model: options.model || "whisper-1",
      ...options,
    });

    return {
      text: transcription.text,
    };
  }

  return {
    createChatCompletion,
    transcribeAudio,
  };
}
