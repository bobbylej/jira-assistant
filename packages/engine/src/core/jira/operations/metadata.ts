import { jiraRequest } from "../client";
import { CreateIssueMetadataResponse, CreateFieldMetadataResponse, JiraClient } from "../types";

export function configureMetadataOperations(client: JiraClient) {
  async function getCreateMetadataIssueTypes(projectIdOrKey: string) {
    const response = await jiraRequest<CreateIssueMetadataResponse>(
      client,
      `/rest/api/3/issue/createmeta/${projectIdOrKey}/issuetypes`,
      "GET"
    );
    return response;
  }

  async function getCreateFieldMetadata(
    projectIdOrKey: string,
    issueTypeId: string
  ) {
    const response = await jiraRequest<CreateFieldMetadataResponse>(
      client,
      `/rest/api/3/issue/createmeta/${projectIdOrKey}/issuetypes/${issueTypeId}`,
      "GET"
    );
    return response;
  }

  return {
    getCreateMetadataIssueTypes,
    getCreateFieldMetadata,
  };
}
