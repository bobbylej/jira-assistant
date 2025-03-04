import { ActionHandler, Action, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export const actionHandlers: ActionHandler[] = [
  {
    actionType: 'getIssue',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const issue = await services.jiraService.getIssue(action.parameters);
      return {
        success: true,
        message: `Issue Key: ${issue.key}\nSummary: ${issue.fields.summary}\nStatus: ${issue.fields.status.name}\nType: ${issue.fields.issuetype.name}`
      };
    }
  },
  {
    actionType: 'searchIssues',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const searchResult = await services.jiraService.searchIssues(action.parameters);
      let message = `Found ${searchResult.issues.length} issues:\n\n`;
      
      searchResult.issues.forEach((issue: any, index: number) => {
        message += `${index + 1}. Issue Key: ${issue.key}\n   Summary: ${issue.fields.summary}\n   Status: ${issue.fields.status.name}\n\n`;
      });
      
      return {
        success: true,
        message
      };
    }
  },
  {
    actionType: 'createIssue',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const newIssue = await services.jiraService.createIssue(action.parameters);
      return {
        success: true,
        message: `Successfully created issue: ${newIssue.key}`
      };
    }
  },
  {
    actionType: 'updateIssueType',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      await services.jiraService.updateIssueType(action.parameters);
      return {
        success: true,
        message: `Successfully updated issue type for ${action.parameters.issueKey} to ${action.parameters.issueType}`
      };
    }
  },
  {
    actionType: 'deleteIssue',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const deleteResult = await services.jiraService.deleteIssue(action.parameters);
      return {
        success: deleteResult.success,
        message: deleteResult.message
      };
    }
  },
  {
    actionType: 'addComment',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      await services.jiraService.addComment(action.parameters);
      return {
        success: true,
        message: `Successfully added comment to issue ${action.parameters.issueKey}`
      };
    }
  },
  {
    actionType: 'assignIssue',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      await services.jiraService.assignIssue(action.parameters);
      return {
        success: true,
        message: `Successfully assigned issue ${action.parameters.issueKey}`
      };
    }
  },
  {
    actionType: 'getIssueTransitions',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const transitions = await services.jiraService.getIssueTransitions(action.parameters);
      let transitionsMessage = `Available transitions for ${action.parameters.issueKey}:\n\n`;
      
      transitions.transitions.forEach((transition: any, index: number) => {
        transitionsMessage += `${index + 1}. ID: ${transition.id}, Name: ${transition.name}\n`;
      });
      
      return {
        success: true,
        message: transitionsMessage
      };
    }
  },
  {
    actionType: 'transitionIssue',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      await services.jiraService.transitionIssue(action.parameters);
      return {
        success: true,
        message: `Successfully transitioned issue ${action.parameters.issueKey}`
      };
    }
  },
  {
    actionType: 'getProjectUsers',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      const users = await services.jiraService.getProjectUsers(action.parameters);
      let usersMessage = `Users for project ${action.parameters.projectKey}:\n\n`;
      
      users.forEach((user: any, index: number) => {
        usersMessage += `${index + 1}. Name: ${user.displayName}, Account ID: ${user.accountId}\n`;
      });
      
      return {
        success: true,
        message: usersMessage
      };
    }
  },
  {
    actionType: 'updateIssuePriority',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      await services.jiraService.updateIssuePriority(action.parameters);
      return {
        success: true,
        message: `Successfully updated priority for issue ${action.parameters.issueKey} to ${action.parameters.priority}`
      };
    }
  },
  {
    actionType: 'message',
    handler: async (action: Action, services: any): Promise<ActionResult> => {
      return {
        success: true,
        message: action.parameters.message
      };
    }
  }
]; 