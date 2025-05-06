import { AIProviderType } from "../adapters/ai/types";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface EngineConfig {
  aiApiKey: string;
  aiProvider: AIProviderType;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  logsDir: string;
  dataDir: string;
}
