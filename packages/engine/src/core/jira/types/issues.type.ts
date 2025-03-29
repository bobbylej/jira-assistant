export type CreateIssueParams = {
  projectKey: string;
  summary: string;
  description?: string;
  issueType: string;
} & Record<string, any>;
