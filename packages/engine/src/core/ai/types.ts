import { JiraActionParams } from "../jira";

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
  role: "user" | "assistant";
  content: string;
}

export interface CreateEpicAndLinkParams {
  projectKey: string;
  epicSummary: string;
  epicDescription?: string;
  issueKey: string;
}

export interface CreateAndLinkSubtasksParams {
  projectKey: string;
  parentIssueKey: string;
  subtasks: { summary: string; description?: string; assignee?: string }[];
}

export interface MoveToEpicParams {
  projectKey: string;
  targetEpicKey: string;
  issueKey: string;
}

type JiraSingleStepActionParamsType =
  | { actionType: "getIssue"; parameters: JiraActionParams<"getIssue">[0] }
  | { actionType: "createIssue"; parameters: JiraActionParams<"createIssue">[0] }
  | { actionType: "updateIssue"; parameters: JiraActionParams<"updateIssue">[0] }
  | { actionType: "deleteIssue"; parameters: JiraActionParams<"deleteIssue">[0] }
  | { actionType: "addComment"; parameters: JiraActionParams<"addComment">[0] }
  | { actionType: "assignIssue"; parameters: JiraActionParams<"assignIssue">[0] }
  | {
      actionType: "updateIssueType";
      parameters: JiraActionParams<"updateIssueType">[0];
    }
  | { actionType: "searchIssues"; parameters: JiraActionParams<"searchIssues">[0] }
  | {
      actionType: "getIssueTransitions";
      parameters: JiraActionParams<"getIssueTransitions">[0];
    }
  | {
      actionType: "transitionIssue";
      parameters: JiraActionParams<"transitionIssue">[0];
    }
  | {
      actionType: "getProjectUsers";
      parameters: JiraActionParams<"getProjectUsers">[0];
    }
  | {
      actionType: "getProjectInfo";
      parameters: JiraActionParams<"getProjectInfo">[0];
    }
  | {
      actionType: "updateIssuePriority";
      parameters: JiraActionParams<"updateIssuePriority">[0];
    }
  | { actionType: "linkIssues"; parameters: JiraActionParams<"linkIssues">[0] }
  | { actionType: "createEpicAndLink"; parameters: CreateEpicAndLinkParams }
  | { actionType: "createAndLinkSubtasks"; parameters: CreateAndLinkSubtasksParams }
  | { actionType: "moveToEpic"; parameters: MoveToEpicParams }
  | { actionType: "message"; parameters: { message: string } }

export type JiraActionParamsType =
  | JiraSingleStepActionParamsType;
