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