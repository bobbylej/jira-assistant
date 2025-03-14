import {
  JiraClient,
  JiraIssue,
  JiraResponse,
  JiraSearchResult,
  LinkIssueJiraResponse,
  SingleIssueJiraResponse,
} from "../types";
import { jiraRequest } from "../client";
import { logger } from "../../../utils/logger";

export function configureIssueOperations(client: JiraClient) {
  async function getIssue({
    issueKey,
  }: {
    issueKey: string;
  }): Promise<SingleIssueJiraResponse> {
    logger.info(`Getting issue: ${issueKey}`);
    const issue = await jiraRequest<JiraIssue>(
      client,
      `/rest/api/3/issue/${issueKey}`,
      "GET"
    );

    return {
      success: true,
      message: `Successfully retrieved issue: ${issueKey}`,
      data: issue,
    };
  }

  async function searchIssues({
    jql,
    maxResults = 10,
  }: {
    jql: string;
    maxResults?: number;
  }): Promise<JiraResponse<JiraSearchResult>> {
    logger.info(`Searching issues with JQL: ${jql}`);

    const searchResult = await jiraRequest<JiraSearchResult>(client, "/rest/api/3/search", "POST", {
      jql,
      maxResults,
      fields: ["summary", "status", "issuetype", "priority", "assignee"],
    });

    return {
      success: true,
      message: `Found ${searchResult.issues.length} issues`,
      data: searchResult,
    };
  }

  async function createIssue({
    projectKey,
    summary,
    description,
    issueType = "Task",
    priority,
    assignee,
    parentIssueKey
  }: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType?: string;
    priority?: string;
    assignee?: string;
    parentIssueKey?: string;
  }): Promise<SingleIssueJiraResponse> {
    logger.info(`Creating issue in project ${projectKey}: ${summary}`);

    // Format the description (it's already been enhanced by the AI if needed)
    const formattedDescription = description
      ? formatDescription(description, issueType)
      : generateDefaultDescription(issueType, summary);

    const issueData: any = {
      fields: {
        project: {
          key: projectKey,
        },
        summary: summary,
        issuetype: {
          name: issueType,
        },
      },
    };

    // Add description if provided
    if (formattedDescription) {
      issueData.fields.description = formattedDescription;
    }

    // Add priority if provided
    if (priority) {
      issueData.fields.priority = {
        name: priority,
      };
    }

    // Add assignee if provided
    if (assignee) {
      issueData.fields.assignee = {
        id: assignee,
      };
    }

    // Add parent issue key if provided
    if (parentIssueKey) {
      issueData.fields.parent = {
        key: parentIssueKey
      };
    }

    const response = await jiraRequest<{
      id: string;
      key: string;
      self: string;
    }>(client, "/rest/api/3/issue", "POST", issueData);

    const { data: issue }= await getIssue({ issueKey: response.key });

    // Get the full issue details
    return {
      success: true,
      message: `Successfully created issue: ${response.key}`,
      data: issue,
    };
  }

  /**
   * Formats a description into Jira's Atlassian Document Format
   */
  function formatDescription(description: string, issueType: string): any {
    // If the description is already in ADF format, return it as is
    if (typeof description === "object") {
      return description;
    }

    // Create a basic ADF document
    const adfDoc = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: description,
            },
          ],
        },
      ],
    };

    return adfDoc;
  }

  /**
   * Generates a default description template based on issue type
   */
  function generateDefaultDescription(issueType: string, summary: string): any {
    let template: any = {
      type: "doc",
      version: 1,
      content: [],
    };

    // Add a heading
    template.content.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: summary }],
    });

    // Add different sections based on issue type
    switch (issueType.toLowerCase()) {
      case "epic":
        template.content.push(
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Epic Overview" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "This epic covers..." }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Goals" }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Goal 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Goal 2" }],
                  },
                ],
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Success Criteria" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This epic will be considered successful when...",
              },
            ],
          }
        );
        break;

      case "story":
        template.content.push(
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "User Story" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "As a [type of user], I want [goal] so that [benefit].",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Acceptance Criteria" }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Criterion 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Criterion 2" }],
                  },
                ],
              },
            ],
          }
        );
        break;

      case "bug":
        template.content.push(
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Description" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Describe the bug here..." }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Steps to Reproduce" }],
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Step 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Step 2" }],
                  },
                ],
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Expected Behavior" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "What should happen..." }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Actual Behavior" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "What actually happens..." }],
          }
        );
        break;

      default: // Task or any other type
        template.content.push(
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Description" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Describe the task here..." }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Acceptance Criteria" }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Criterion 1" }],
                  },
                ],
              },
            ],
          }
        );
        break;
    }

    return template;
  }

  async function updateIssueType({
    issueKey,
    issueType,
  }: {
    issueKey: string;
    issueType: string;
  }): Promise<SingleIssueJiraResponse> {
    logger.info(`Updating issue type for ${issueKey} to ${issueType}`);

    await jiraRequest(client, `/rest/api/3/issue/${issueKey}`, "PUT", {
      fields: {
        issuetype: {
          name: issueType,
        },
      },
    });

    const { data: issue } = await getIssue({ issueKey });

    return {
      success: true,
      message: `Successfully updated issue type for ${issueKey} to ${issueType}`,
      data: issue,
    };
  }

  async function updateIssuePriority({
    issueKey,
    priority,
  }: {
    issueKey: string;
    priority: string;
  }): Promise<SingleIssueJiraResponse> {
    logger.info(`Updating priority for issue ${issueKey} to ${priority}`);

    await jiraRequest(client, `/rest/api/3/issue/${issueKey}`, "PUT", {
      fields: {
        priority: {
          name: priority,
        },
      },
    });

    const { data: issue } = await getIssue({ issueKey });

    return {
      success: true,
      message: `Successfully updated priority for issue ${issueKey} to ${priority}`,
      data: issue,
    };
  }

  async function deleteIssue({
    issueKey,
  }: {
    issueKey: string;
  }): Promise<SingleIssueJiraResponse> {
    try {
      logger.info(`Deleting issue: ${issueKey}`);

      const { data: issue } = await getIssue({ issueKey });
      await jiraRequest(client, `/rest/api/3/issue/${issueKey}`, "DELETE");

      return {
        success: true,
        message: `Successfully deleted issue ${issueKey}`,
        data: issue,
      };
    } catch (error: unknown) {
      logger.error("Error deleting issue:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to delete issue: ${errorMessage}`,
      };
    }
  }

  async function linkIssues({
    sourceIssueKey,
    targetIssueKey,
    linkType = "relates to",
  }: {
    sourceIssueKey: string;
    targetIssueKey: string;
    linkType?: string;
  }): Promise<LinkIssueJiraResponse> {
    logger.info(
      `Linking issue ${sourceIssueKey} to ${targetIssueKey} with link type "${linkType}"`
    );

    try {
      // First, check if the target issue is an Epic
      const targetIssue = await jiraRequest<JiraIssue>(
        client,
        `/rest/api/3/issue/${targetIssueKey}`,
        "GET"
      );

      // Check if we're trying to link to an Epic
      if (targetIssue.fields.issuetype.name === "Epic") {
        const epicLinkResult = await linkIssueToEpic(sourceIssueKey, targetIssueKey);
        if (epicLinkResult.success) {
          return epicLinkResult;
        }
        // If epic linking failed, continue to standard linking
      }

      // Use standard issue links as a fallback
      return await createStandardIssueLink(sourceIssueKey, targetIssueKey, linkType);
    } catch (error) {
      logger.error(`Failed to link issues: ${error}`);
      // Try one more approach - add a comment mentioning the relationship
      return await createReferenceComment(sourceIssueKey, targetIssueKey, error);
    }
  }

  /**
   * Attempts to link an issue to an Epic using the Epic Link field
   */
  async function linkIssueToEpic(
    sourceIssueKey: string, 
    epicKey: string
  ): Promise<LinkIssueJiraResponse> {
    logger.info(`Target issue ${epicKey} is an Epic`);

    try {
      // For Jira Cloud, we need to find the Epic Link field
      const fieldsMetadata = await jiraRequest<any>(
        client,
        `/rest/api/3/field`,
        "GET"
      );

      // Find the Epic Link field
      const epicLinkField = fieldsMetadata.find(
        (field: any) =>
          field.name === "Epic Link" ||
          field.name === "Parent Link" ||
          field.name.includes("Epic")
      );

      if (epicLinkField) {
        logger.info(`Found Epic Link field: ${epicLinkField.id}`);

        try {
          // Try to update the Epic Link field
          await jiraRequest(
            client,
            `/rest/api/3/issue/${sourceIssueKey}`,
            "PUT",
            {
              fields: {
                [epicLinkField.id]: epicKey,
              },
            }
          );

          const { data: sourceIssue } = await getIssue({ issueKey: sourceIssueKey });
          const { data: targetIssue } = await getIssue({ issueKey: epicKey });

          return {
            success: true,
            message: `Successfully linked issue ${sourceIssueKey} to Epic ${epicKey}`,
            data: {
              sourceIssue,
              targetIssue,
            },
          };
        } catch (epicLinkError) {
          logger.warn(`Failed to set Epic Link field: ${epicLinkError}`);
        }
      }

      // If we couldn't use the Epic Link field, try using the standard issue link
      logger.info(`Falling back to standard issue link for Epic relationship`);
      return { success: false, message: "Epic link field not found or failed to update" };
    } catch (error) {
      logger.error(`Error in linkIssueToEpic: ${error}`);
      return { success: false, message: `Failed to link to Epic: ${error}` };
    }
  }

  /**
   * Creates a standard issue link between two issues
   */
  async function createStandardIssueLink(
    sourceIssueKey: string,
    targetIssueKey: string,
    linkType: string
  ): Promise<LinkIssueJiraResponse> {
    // Map common link type names to Jira's internal link type names
    const linkTypeMap: Record<string, string> = {
      "is part of": "Relates",
      "has part": "Relates",
      parent: "Relates",
      "relates to": "Relates",
      "is related to": "Relates",
      blocks: "Blocks",
      "is blocked by": "Blocked",
    };

    const mappedLinkType = linkTypeMap[linkType.toLowerCase()] || linkType;

    logger.info(`Creating standard issue link with type "${mappedLinkType}"`);

    await jiraRequest(client, "/rest/api/3/issueLink", "POST", {
      type: {
        name: mappedLinkType,
      },
      inwardIssue: {
        key: targetIssueKey,
      },
      outwardIssue: {
        key: sourceIssueKey,
      },
    });

    const { data: sourceIssue } = await getIssue({ issueKey: sourceIssueKey });
    const { data: targetIssue } = await getIssue({ issueKey: targetIssueKey });

    return {
      success: true,
      message: `Successfully linked issue ${sourceIssueKey} to ${targetIssueKey} with type "${mappedLinkType}"`,
      data: {
        sourceIssue,
        targetIssue,
      },
    };
  }

  /**
   * Adds a reference comment when direct linking fails
   */
  async function createReferenceComment(
    sourceIssueKey: string,
    targetIssueKey: string,
    originalError: unknown
  ): Promise<LinkIssueJiraResponse> {
    try {
      logger.info(`Falling back to adding a comment about the relationship`);

      await jiraRequest(
        client,
        `/rest/api/3/issue/${sourceIssueKey}/comment`,
        "POST",
        {
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `This issue is related to ${targetIssueKey}. Note: Direct linking failed, this is a reference comment.`,
                  },
                ],
              },
            ],
          },
        }
      );

      const { data: sourceIssue } = await getIssue({ issueKey: sourceIssueKey });
      const { data: targetIssue } = await getIssue({ issueKey: targetIssueKey });

      return {
        success: true,
        message: `Could not create a direct link, but added a comment referencing ${targetIssueKey}`,
        data: {
          sourceIssue,
          targetIssue,
        },
      };
    } catch (commentError) {
      logger.error(`Failed to add reference comment: ${commentError}`);
      throw originalError; // Throw the original error
    }
  }

  async function updateIssue({
    issueKey,
    summary,
    description,
    issueType,
    priority,
    assignee,
  }: {
    issueKey: string;
    summary?: string;
    description?: string;
    issueType?: string;
    priority?: string;
    assignee?: string;
  }): Promise<SingleIssueJiraResponse> {
    logger.info(`Updating issue ${issueKey}`);

    // Prepare the fields to update
    const fields: any = {};

    // Only get the current issue if we need to format the description
    if (description) {
      // Get the current issue to determine its type for description formatting
      let currentIssueType: string | undefined;
      try {
        const { data: currentIssue } = await getIssue({ issueKey });
        currentIssueType = currentIssue?.fields.issuetype.name;
      } catch (error) {
        logger.warn(`Could not get current issue type for ${issueKey}:`, error);
      }

      // Format the description with the appropriate issue type
      fields.description = formatDescription(
        description,
        currentIssueType || issueType || ""
      );
    }

    // Add other fields that are provided
    if (summary !== undefined) {
      fields.summary = summary;
    }

    if (issueType !== undefined) {
      fields.issuetype = {
        name: issueType,
      };
    }

    if (priority !== undefined) {
      fields.priority = {
        name: priority,
      };
    }

    if (assignee !== undefined) {
      fields.assignee = {
        id: assignee,
      };
    }

    // Only proceed if there are fields to update
    if (Object.keys(fields).length === 0) {
      return {
        success: false,
        message: "No fields provided for update",
      };
    }

    // Make the update request
    await jiraRequest(client, `/rest/api/3/issue/${issueKey}`, "PUT", {
      fields,
    });

    // Build a message about what was updated
    const updatedFields = Object.keys(fields).map((field) => {
      if (field === "issuetype") return "issue type";
      return field;
    });

    const { data: issue } = await getIssue({ issueKey });

    return {
      success: true,
      message: `Successfully updated ${updatedFields.join(
        ", "
      )} for issue ${issueKey}`,
      data: issue,
    };
  }

  // Return all the operations
  return {
    getIssue,
    searchIssues,
    createIssue,
    updateIssueType,
    updateIssuePriority,
    deleteIssue,
    linkIssues,
    updateIssue,
  };
}
