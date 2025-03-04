import { ToolCallHandler } from './types';

export const toolCallHandlers: ToolCallHandler[] = [
  {
    functionName: 'get_issue',
    handler: (args) => ({
      actionType: 'getIssue',
      parameters: args
    })
  },
  {
    functionName: 'search_issues',
    handler: (args) => ({
      actionType: 'searchIssues',
      parameters: args
    })
  },
  {
    functionName: 'create_issue',
    handler: (args) => ({
      actionType: 'createIssue',
      parameters: args
    })
  },
  {
    functionName: 'update_issue_type',
    handler: (args) => ({
      actionType: 'updateIssueType',
      parameters: {
        issueKey: args.issueKey,
        issueType: args.newIssueType
      }
    })
  },
  {
    functionName: 'delete_issue',
    handler: (args) => ({
      actionType: 'deleteIssue',
      parameters: {
        issueKey: args.issueKey
      }
    })
  },
  {
    functionName: 'add_comment',
    handler: (args) => ({
      actionType: 'addComment',
      parameters: args
    })
  },
  {
    functionName: 'assign_issue',
    handler: (args) => ({
      actionType: 'assignIssue',
      parameters: args
    })
  },
  {
    functionName: 'get_issue_transitions',
    handler: (args) => ({
      actionType: 'getIssueTransitions',
      parameters: args
    })
  },
  {
    functionName: 'transition_issue',
    handler: (args) => ({
      actionType: 'transitionIssue',
      parameters: args
    })
  },
  {
    functionName: 'get_project_users',
    handler: (args) => ({
      actionType: 'getProjectUsers',
      parameters: args
    })
  },
  {
    functionName: 'update_issue_priority',
    handler: (args) => ({
      actionType: 'updateIssuePriority',
      parameters: args
    })
  }
]; 