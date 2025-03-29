import { FieldMetadata } from "../../jira";
import { JiraContext } from "../types";

/**
 * Converts a JiraContext object into a descriptive text format
 * that's easier for the AI to understand and utilize
 */
export function convertJiraContextToText(context: JiraContext | null): string {
  if (!context) return "";

  let contextText = "# Current Jira Context\n";

  // Add project information
  if (context.projectKey) {
    contextText += `## Project: ${context.projectKey}\n`;
  }

  // Add issue information if available
  if (context.issueKey) {
    contextText += `## Issue: ${context.issueKey}\n`;

    if (context.issueSummary) {
      contextText += `Summary: "${context.issueSummary}"\n`;
    }

    if (context.issueStatus) {
      contextText += `Status: ${context.issueStatus}\n`;
    }

    if (context.issueType) {
      contextText += `Type: ${context.issueType}\n`;
    }

    if (context.assignee) {
      contextText += `Assignee: ${context.assignee}\n`;
    }

    // Add description if available
    if (context.issueDescription) {
      contextText += `\nDescription:\n${context.issueDescription}\n`;
    }

    // Add comments if available
    if (context.comments && context.comments.length > 0) {
      contextText += `\nThis issue has ${context.comments.length} comments.\n`;

      // Include recent comments
      if (context.comments.length <= 3) {
        contextText += "Recent comments:\n";
        context.comments.forEach((comment, index) => {
          contextText += `- Comment ${index + 1}: ${comment.text.substring(
            0,
            100
          )}${comment.text.length > 100 ? "..." : ""}\n`;
        });
      } else {
        contextText +=
          "Most recent comment: " +
          context.comments[context.comments.length - 1].text.substring(0, 100) +
          (context.comments[context.comments.length - 1].text.length > 100
            ? "..."
            : "") +
          "\n";
      }
    }
  }

  // Add board information if available
  if (context.boardId) {
    contextText += `\n## Board Information\n`;
    contextText += `Board ID: ${context.boardId}\n`;

    if (context.boardType) {
      contextText += `Board Type: ${context.boardType}\n`;
    }
  }

  // Add URL information
  if (context.url) {
    contextText += `\n## URL\n${context.url}\n`;
  }

  // Add capabilities section to guide the AI
  contextText += "\n## Available Actions\n";
  contextText += "- Create new issues in the current project\n";
  contextText += "- Update issue details (status, assignee, etc.)\n";
  contextText += "- Add comments to issues\n";
  contextText += "- Search for issues by key or criteria\n";
  contextText += "- Provide information about Jira concepts\n";

  return contextText.trim();
}

/**
 * Creates an enhanced prompt by combining the user's message with the Jira context
 */
export function createEnhancedPrompt(
  userMessage: string,
  contextText: string
): string {
  if (!contextText) {
    return userMessage;
  }

  // Start with the context
  let prompt = `${contextText}\n\n`;

  // Add the user's message
  prompt += `User request: "${userMessage}"\n\n`;

  // Add instructions for the AI
  prompt +=
    "Based on the Jira context above, please interpret the user's request and determine the appropriate action. " +
    "If the request is related to the current Jira context, use that information to provide a more relevant response. " +
    "If the user is asking about creating, updating, or managing Jira issues, consider the current project and board context.\n\n" +
    "Important notes for Jira operations:\n" +
    "1. When updating issue types, make sure the target type exists in the project (common types: Task, Story, Bug, Epic)\n" +
    "2. When creating subtasks, they must be linked to a parent issue\n" +
    "3. Some operations may require specific permissions in Jira\n" +
    "4. If an operation fails, provide a helpful error message and suggest alternatives";

  return prompt;
}

export const sampleAttlassianDocumentFormat = {
  version: 1,
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Hello ",
        },
        {
          type: "text",
          text: "world",
          marks: [
            {
              type: "strong",
            },
          ],
        },
      ],
    },
  ],
};

export const generateDocFieldDescription = (
  field: FieldMetadata,
  action: "create" | "update" = "create"
) => {
  return ` - Use Atlassian Document Format JSON object. Example:\n\`\`\`\n${JSON.stringify(
    sampleAttlassianDocumentFormat
  )}\n\`\`\`\n${
    field.defaultValue
      ? ` - Use this as a template:\n\`\`\`\n${JSON.stringify(
          field.defaultValue
        )}\n\`\`\`\nKeep the same format, sections, etc. Use template to generate the new value ${
          action === "update" ? "if it was requested" : ""
        }. If template includes headers or sections make sure to keep them in the new value`
      : ""
  }`;
};
