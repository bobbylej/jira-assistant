export interface JiraContext {
  url?: string;
  domain?: string;
  projectKey?: string;
  issueKey?: string;
  issueSummary?: string;
  issueStatus?: string;
  issueType?: string;
  issueDescription?: string;
  assignee?: string;
  boardId?: string;
  boardType?: string;
  comments?: Array<{ text: string; author?: string; created?: string }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}