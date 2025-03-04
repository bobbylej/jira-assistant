import { ChatCompletionTool } from "openai/resources/chat";

// Define system prompts
export const SYSTEM_PROMPT = `You are a helpful Jira assistant. You can help users manage their Jira issues, search for information, and perform various Jira-related tasks. Always be concise and helpful.`;

// Define tools
export const JIRA_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_issue",
      description: "Get details of a Jira issue by its key",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
        },
        required: ["issueKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_issues",
      description: "Search for Jira issues using JQL",
      parameters: {
        type: "object",
        properties: {
          jql: {
            type: "string",
            description:
              "JQL query string (e.g., 'project = PROJ AND status = \"In Progress\"')",
          },
          maxResults: {
            type: "integer",
            description: "Maximum number of results to return",
          },
        },
        required: ["jql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_issue",
      description: "Create a new Jira issue",
      parameters: {
        type: "object",
        properties: {
          projectKey: {
            type: "string",
            description: "The project key (e.g., PROJ)",
          },
          summary: {
            type: "string",
            description: "Issue summary/title",
          },
          description: {
            type: "string",
            description: "Detailed description of the issue",
          },
          issueType: {
            type: "string",
            description: "Type of issue (e.g., Bug, Task, Story)",
          },
        },
        required: ["projectKey", "summary", "issueType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_issue_type",
      description: "Update the issue type of an existing Jira issue",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key to update",
          },
          newIssueType: {
            type: "string",
            description: "The new issue type (e.g., Epic, Story, Task, Bug)",
          },
        },
        required: ["issueKey", "newIssueType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_issue",
      description: "Delete a Jira issue by its key",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
          confirmDelete: {
            type: "boolean",
            description: "Confirmation that the issue should be deleted",
          },
        },
        required: ["issueKey", "confirmDelete"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_comment",
      description: "Add a comment to a Jira issue",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
          comment: {
            type: "string",
            description: "The comment text to add to the issue",
          },
        },
        required: ["issueKey", "comment"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_issue",
      description: "Assign a Jira issue to a user",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
          accountId: {
            type: "string",
            description: "The account ID of the user to assign the issue to",
          },
        },
        required: ["issueKey", "accountId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transition_issue",
      description: "Move a Jira issue to a different status",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
          transitionId: {
            type: "string",
            description: "The ID of the transition to perform",
          },
        },
        required: ["issueKey", "transitionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_issue_transitions",
      description: "Get available transitions for a Jira issue",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
        },
        required: ["issueKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_users",
      description: "Get users associated with a Jira project",
      parameters: {
        type: "object",
        properties: {
          projectKey: {
            type: "string",
            description: "The project key (e.g., PROJ)",
          },
        },
        required: ["projectKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_issue_priority",
      description: "Update the priority of a Jira issue",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The Jira issue key (e.g., PROJ-123)",
          },
          priority: {
            type: "string",
            description: "The new priority (e.g., Highest, High, Medium, Low, Lowest)",
          },
        },
        required: ["issueKey", "priority"],
      },
    },
  },
];
