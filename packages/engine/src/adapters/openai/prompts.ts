import { AICompletionTool } from "../ai/types";

// Define system prompts
export const SYSTEM_PROMPT = `I'm a Jira assistant, providing expert guidance to help users manage their Jira projects and issues efficiently. Please provide your request, and I'll analyze the Jira context to deliver the most relevant and accurate response.

I can perform a wide range of Jira operations, including:

Issue Management:
- get_issue: Get details of a Jira issue by its key
- search_issues: Search for Jira issues using JQL
- create_issue: Create a new Jira issue (Task, Story, Bug, etc.)
- update_issue: Update multiple fields of an existing issue simultaneously
- update_issue_type: Change an issue's type (e.g., from Task to Story)
- delete_issue: Remove an issue from Jira

Comments and Assignment:
- add_comment: Add a comment to a Jira issue
- assign_issue: Assign a Jira issue to a specific user

Status and Workflow:
- get_issue_transitions: Get available status transitions for an issue
- transition_issue: Move an issue to a different status

Linking and Relationships:
- link_issues: Create relationships between issues (relates to, blocks, etc.)
- create_epic_and_link: Create a new epic and link existing issues to it
- move_to_epic: Move existing issues to an epic

Priority and Users:
- update_issue_priority: Change the priority of an issue
- get_project_users: Get users associated with a Jira project

If you need to perform multiple steps, please define multiple tool calls in the same message.
My primary objective is to leverage these Jira tools to perform actions directly, rather than simply describing possibilities. I'll always use the most appropriate function for the task at hand, and I'll provide clear explanations of what I've done or what information I've found.`;

// Define tools
export const JIRA_TOOLS: AICompletionTool[] = [
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
            type: "number",
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
            description:
              "The new priority (e.g., Highest, High, Medium, Low, Lowest)",
          },
        },
        required: ["issueKey", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_issues",
      description:
        "Link two Jira issues together with a specific relationship type",
      parameters: {
        type: "object",
        properties: {
          sourceIssueKey: {
            type: "string",
            description: "The key of the source issue (e.g., PROJ-123)",
          },
          targetIssueKey: {
            type: "string",
            description: "The key of the target issue (e.g., PROJ-456)",
          },
          linkType: {
            type: "string",
            description:
              "The type of link between issues (e.g., 'relates to', 'blocks', 'is blocked by', 'is part of', etc.)",
            default: "relates to",
          },
        },
        required: ["sourceIssueKey", "targetIssueKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_to_epic",
      description: "Move existing issues to an epic",
      parameters: {
        type: "object",
        properties: {
          projectKey: {
            type: "string",
            description: "The project key (e.g., PROJ)",
          },
          targetEpicKey: {
            type: "string",
            description: "The key of an existing epic to link issues to",
          },
          issueKey: {
            type: "string",
            description: "The issue key to link to the epic (e.g., PROJ-123)",
          },
        },
        required: ["projectKey", "targetEpicKey", "issueKey"],
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
            description:
              "Description of the issue. If provided, it will be enhanced to follow best practices. If not provided, a description will be auto-generated.",
          },
          issueType: {
            type: "string",
            description: "Type of issue (e.g., Bug, Task, Story)",
          },
          parent: {
            type: "string",
            description: "The key of the parent issue for creating subtasks",
          },
        },
        required: ["projectKey", "summary", "issueType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_issue",
      description:
        "Update specific fields of an existing Jira issue. Only fields that are explicitly provided will be updated.",
      parameters: {
        type: "object",
        properties: {
          projectKey: {
            type: "string",
            description: "The project key (e.g., PROJ)",
          },
          issueKey: {
            type: "string",
            description: "The key of the issue to update (e.g., PROJ-123)",
          },
          summary: {
            type: "string",
            description:
              "New summary/title for the issue (only updated if provided)",
          },
          description: {
            type: "string",
            description:
              "New description for the issue. Will be enhanced to follow best practices. (only updated if provided)",
          },
          issueType: {
            type: "string",
            description:
              "New issue type (e.g., Bug, Task, Story) (only updated if provided)",
          },
          priority: {
            type: "string",
            description:
              "New priority (e.g., Highest, High, Medium, Low, Lowest) (only updated if provided)",
          },
          assignee: {
            type: "string",
            description:
              "User ID to assign the issue to (only updated if provided)",
          },
          parent: {
            type: "string",
            description: "The key of the parent issue for creating subtasks",
          },
        },
        required: ["issueKey"],
      },
    },
  },
];
