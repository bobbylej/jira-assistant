import { ToolFunctionProperty } from "../../core/ai";

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

export interface StructuredOutputConfig {
  type: 'json' | 'enum';
  schema?: {
    type: 'object' | 'array';
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      format?: string;
      items?: {
        type: string;
        description?: string;
      };
    }>;
    required?: string[];
    items?: {
      type: string;
      description?: string;
    };
  };
  enum?: string[];
}

export interface AICompletionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolFunctionProperty>;
      required?: string[];
    };
  };
}

export interface AICompletionParams {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  tools?: AICompletionTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  structuredOutput?: StructuredOutputConfig;
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
