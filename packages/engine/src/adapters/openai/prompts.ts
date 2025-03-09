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
            description: "Description of the issue. If provided, it will be enhanced to follow best practices. If not provided, a description will be auto-generated.",
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
  {
    type: "function",
    function: {
      name: "link_issues",
      description: "Link two Jira issues together with a specific relationship type",
      parameters: {
        type: "object",
        properties: {
          sourceIssueKey: {
            type: "string",
            description: "The key of the source issue (e.g., PROJ-123)"
          },
          targetIssueKey: {
            type: "string",
            description: "The key of the target issue (e.g., PROJ-456)"
          },
          linkType: {
            type: "string",
            description: "The type of link between issues (e.g., 'relates to', 'blocks', 'is blocked by', 'is part of', etc.)",
            default: "relates to"
          }
        },
        required: ["sourceIssueKey", "targetIssueKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "multi_step_operation",
      description: "Perform a sequence of related Jira operations as a single transaction",
      parameters: {
        type: "object",
        properties: {
          operationType: {
            type: "string",
            description: "The type of multi-step operation to perform",
            enum: ["create_epic_and_link", "create_and_link_subtasks", "move_to_epic"]
          },
          parameters: {
            type: "object",
            description: "Parameters specific to the operation type",
            properties: {
              projectKey: {
                type: "string",
                description: "The project key (e.g., PROJ)"
              },
              epicSummary: {
                type: "string",
                description: "Summary for the new epic"
              },
              epicDescription: {
                type: "string",
                description: "Description for the new epic. If provided, it will be enhanced to follow best practices. If not provided, a description will be auto-generated."
              },
              issueKey: {
                type: "string",
                description: "The issue key to link to the epic (e.g., PROJ-123)"
              },
              targetEpicKey: {
                type: "string",
                description: "The key of an existing epic to link issues to"
              }
            }
          }
        },
        required: ["operationType", "parameters"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_issue",
      description: "Update specific fields of an existing Jira issue. Only fields that are explicitly provided will be updated.",
      parameters: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "The key of the issue to update (e.g., PROJ-123)"
          },
          summary: {
            type: "string",
            description: "New summary/title for the issue (only updated if provided)"
          },
          description: {
            type: "string",
            description: "New description for the issue. Will be enhanced to follow best practices. (only updated if provided)"
          },
          issueType: {
            type: "string",
            description: "New issue type (e.g., Bug, Task, Story) (only updated if provided)"
          },
          priority: {
            type: "string",
            description: "New priority (e.g., Highest, High, Medium, Low, Lowest) (only updated if provided)"
          },
          assignee: {
            type: "string",
            description: "User ID to assign the issue to (only updated if provided)"
          }
        },
        required: ["issueKey"]
      }
    }
  }
];
