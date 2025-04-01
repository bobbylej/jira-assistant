export interface OpenAIConfig {
  apiKey: string;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface EngineConfig {
  openaiApiKey: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  logsDir: string;
  dataDir: string;
}

export interface AIConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'ollama';
  apiKey: string;
  // Other common AI configuration options
}

export interface OpenAIConfig extends AIConfig {
  // OpenAI specific configuration
}

export interface GeminiConfig extends AIConfig {
  // Gemini specific configuration
} 