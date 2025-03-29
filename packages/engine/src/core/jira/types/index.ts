export interface JiraClient {
  baseUrl: string;
  auth: string;
  email: string;
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

export interface JiraResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface SingleIssueJiraResponse extends JiraResponse<JiraIssue> {}

export interface LinkIssueJiraResponse
  extends JiraResponse<{
    sourceIssue?: JiraIssue;
    targetIssue?: JiraIssue;
  }> {}

export interface CreateIssueMetadataResponse {
  issueTypes: {
    description: string;
    id: string;
    name: string;
    subtask: boolean;
  }[];
}

export type FieldValueType = string | number | boolean | string[] | object;

export interface FieldMetadata<T extends FieldValueType = FieldValueType> {
  // The list of values allowed in the field.
  allowedValues?: T[];
  // The URL that can be used to automatically complete the field.
  autoCompleteUrl?: string;
  // The default value of the field.
  defaultValue?: T;
  fieldId: string;
  hasDefaultValue?: boolean;
  key: string;
  name: string;
  // The list of operations that can be performed on the field.
  operations: string[];
  required: boolean;
  schema: {
    // The data type of the field.
    type: string;
    // When the data type is an array, the name of the field items within the array.
    items?: string;
  };
}

export interface CreateFieldMetadataResponse<
  T extends FieldValueType = FieldValueType
> {
  fields: FieldMetadata<T>[];
}

export type IssueTypeMetadata<T extends FieldValueType = FieldValueType> =
  CreateIssueMetadataResponse["issueTypes"][number] & {
    fields: CreateFieldMetadataResponse<T>["fields"];
  };

export interface ProjectMetadata<T extends FieldValueType = FieldValueType> {
  projectKey: string;
  issueTypes: IssueTypeMetadata<T>[];
}
