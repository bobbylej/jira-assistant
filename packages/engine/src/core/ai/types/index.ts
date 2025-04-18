import { JiraActionParams } from "../../jira";

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

export interface MoveToEpicParams {
  projectKey: string;
  targetEpicKey: string;
  issueKey: string;
}

type JiraSingleStepActionParamsType =
  | { actionType: "getIssue"; parameters: JiraActionParams<"getIssue">[0] }
  | {
      actionType: "createIssue";
      parameters: JiraActionParams<"createIssue">[0];
    }
  | {
      actionType: "updateIssue";
      parameters: JiraActionParams<"updateIssue">[0];
    }
  | {
      actionType: "deleteIssue";
      parameters: JiraActionParams<"deleteIssue">[0];
    }
  | { actionType: "addComment"; parameters: JiraActionParams<"addComment">[0] }
  | {
      actionType: "assignIssue";
      parameters: JiraActionParams<"assignIssue">[0];
    }
  | {
      actionType: "updateIssueType";
      parameters: JiraActionParams<"updateIssueType">[0];
    }
  | {
      actionType: "searchIssues";
      parameters: JiraActionParams<"searchIssues">[0];
    }
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
  | { actionType: "moveToEpic"; parameters: MoveToEpicParams }
  | { actionType: "message"; parameters: { message: string } };

export type JiraActionParamsType = JiraSingleStepActionParamsType;

export type ToolFunctionPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "doc";

export interface ToolFunctionProperty {
  description: string;
  type: ToolFunctionPropertyType;
  additionalProperties?: boolean;
  enum?: string[];
  items?: ToolFunctionProperty;
  name?: string;
  properties?: Record<string, ToolFunctionProperty>;
  default?: any;
}

export type JiraParamWithMetadata<T extends string | number | symbol = string> = {
  key: T;
  fieldName: string;
  value: string;
  isADFField?: boolean;
  template?: string;
};

export type JiraParamsWithMetadata<T extends string | number | symbol = string> = Record<
  T,
  JiraParamWithMetadata<T>
>;
