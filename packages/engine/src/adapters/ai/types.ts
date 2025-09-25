import {
  ChatCompletionCreateParams,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export interface AIModelConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  [key: string]: any; // For provider-specific configuration
}

export interface AIProvider {
  // Chat completion interface
  createChatCompletion(
    params: AICompletionParams
  ): Promise<AICompletionResponse>;

  // Audio transcription interface
  transcribeAudio(
    audioFile: {
      path: string;
      type: string;
    },
    options?: any
  ): Promise<AITranscriptionResponse>;
}

type ChatMessageUser = {
  role: 'user';
  content: string;
}

type ChatMessageAssistant = {
  role: 'assistant';
  content: string;
}

type ChatMessageSystem = {
  role: 'system';
  content: string;
}

export type ChatMessage = ChatMessageUser | ChatMessageAssistant | ChatMessageSystem;

export interface AICompletionParams {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  tools?: ChatCompletionTool[];
  tool_choice?: any;
  [key: string]: any; // For provider-specific parameters
}

export interface AICompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: any[];
    };
    index: number;
  }>;
  [key: string]: any; // For provider-specific response fields
}

export interface AITranscriptionResponse {
  text: string;
  [key: string]: any; // For provider-specific response fields
}

export type AIProviderType = "openai" | "gemini" | "anthropic" | "ollama";
