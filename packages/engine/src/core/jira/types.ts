export interface JiraClient {
  baseUrl: string;
  auth: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: any;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
      accountId: string;
    };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
} 