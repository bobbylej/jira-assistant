import { OpenAI } from 'openai';
import { JIRA_TOOLS } from '../../adapters/openai/prompts';
import { logger } from '../../utils/logger';

export function configureCommandService(openai: OpenAI, jiraService: any) {
  async function interpretCommand(text: string, context?: any) {
    try {
      logger.info('Interpreting command:', text);
      
      // Command interpretation logic using OpenAI function calling
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are a Jira assistant..." },
          { role: "user", content: text }
        ],
        tools: JIRA_TOOLS,
        temperature: 0.2,
      });
      
      // Process the response
      const message = response.choices[0].message;
      
      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        logger.info(`Tool call: ${functionName}`, args);
        
        // Map function names to actions
        switch (functionName) {
          case 'get_issue':
            return {
              actionType: 'getIssue',
              parameters: args
            };
          case 'search_issues':
            return {
              actionType: 'searchIssues',
              parameters: args
            };
          case 'create_issue':
            return {
              actionType: 'createIssue',
              parameters: args
            };
          case 'update_issue_type':
            return {
              actionType: 'updateIssueType',
              parameters: {
                issueKey: args.issueKey,
                issueType: args.newIssueType
              }
            };
          case 'delete_issue':
            return {
              actionType: 'deleteIssue',
              parameters: {
                issueKey: args.issueKey
              }
            };
          case 'add_comment':
            return {
              actionType: 'addComment',
              parameters: args
            };
          case 'assign_issue':
            return {
              actionType: 'assignIssue',
              parameters: args
            };
          case 'get_issue_transitions':
            return {
              actionType: 'getIssueTransitions',
              parameters: args
            };
          case 'transition_issue':
            return {
              actionType: 'transitionIssue',
              parameters: args
            };
          case 'get_project_users':
            return {
              actionType: 'getProjectUsers',
              parameters: args
            };
          case 'update_issue_priority':
            return {
              actionType: 'updateIssuePriority',
              parameters: args
            };
          default:
            return {
              actionType: 'message',
              parameters: {
                message: `I don't know how to perform the action: ${functionName}`
              }
            };
        }
      }
      
      return {
        actionType: 'message',
        parameters: {
          message: message.content || 'I understood your request.'
        }
      };
    } catch (error: unknown) {
      logger.error('Error interpreting command:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Error interpreting command: ${errorMessage}`);
    }
  }
  
  async function executeAction(action: any) {
    try {
      logger.info('Executing action:', action);
      
      switch (action.actionType) {
        case 'getIssue':
          const issue = await jiraService.getIssue(action.parameters);
          return {
            success: true,
            message: `Issue Key: ${issue.key}\nSummary: ${issue.fields.summary}\nStatus: ${issue.fields.status.name}\nType: ${issue.fields.issuetype.name}`
          };
          
        case 'searchIssues':
          const searchResult = await jiraService.searchIssues(action.parameters);
          let message = `Found ${searchResult.issues.length} issues:\n\n`;
          
          searchResult.issues.forEach((issue: any, index: number) => {
            message += `${index + 1}. Issue Key: ${issue.key}\n   Summary: ${issue.fields.summary}\n   Status: ${issue.fields.status.name}\n\n`;
          });
          
          return {
            success: true,
            message
          };
          
        case 'createIssue':
          const newIssue = await jiraService.createIssue(action.parameters);
          return {
            success: true,
            message: `Successfully created issue: ${newIssue.key}`
          };
          
        case 'updateIssueType':
          await jiraService.updateIssueType(action.parameters);
          return {
            success: true,
            message: `Successfully updated issue type for ${action.parameters.issueKey} to ${action.parameters.issueType}`
          };
          
        case 'deleteIssue':
          const deleteResult = await jiraService.deleteIssue(action.parameters.issueKey);
          return {
            success: deleteResult.success,
            message: deleteResult.message
          };
          
        case 'addComment':
          await jiraService.addComment(action.parameters);
          return {
            success: true,
            message: `Successfully added comment to issue ${action.parameters.issueKey}`
          };
          
        case 'assignIssue':
          await jiraService.assignIssue(action.parameters);
          return {
            success: true,
            message: `Successfully assigned issue ${action.parameters.issueKey}`
          };
          
        case 'getIssueTransitions':
          const transitions = await jiraService.getIssueTransitions(action.parameters);
          let transitionsMessage = `Available transitions for ${action.parameters.issueKey}:\n\n`;
          
          transitions.transitions.forEach((transition: any, index: number) => {
            transitionsMessage += `${index + 1}. ID: ${transition.id}, Name: ${transition.name}\n`;
          });
          
          return {
            success: true,
            message: transitionsMessage
          };
          
        case 'transitionIssue':
          await jiraService.transitionIssue(action.parameters);
          return {
            success: true,
            message: `Successfully transitioned issue ${action.parameters.issueKey}`
          };
          
        case 'getProjectUsers':
          const users = await jiraService.getProjectUsers(action.parameters);
          let usersMessage = `Users for project ${action.parameters.projectKey}:\n\n`;
          
          users.forEach((user: any, index: number) => {
            usersMessage += `${index + 1}. Name: ${user.displayName}, Account ID: ${user.accountId}\n`;
          });
          
          return {
            success: true,
            message: usersMessage
          };
          
        case 'updateIssuePriority':
          await jiraService.updateIssuePriority(action.parameters);
          return {
            success: true,
            message: `Successfully updated priority for issue ${action.parameters.issueKey} to ${action.parameters.priority}`
          };
          
        case 'message':
          return {
            success: true,
            message: action.parameters.message
          };
          
        default:
          return {
            success: false,
            message: `Unknown action type: ${action.actionType}`
          };
      }
    } catch (error: unknown) {
      logger.error('Error executing action:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Error executing action: ${errorMessage}`
      };
    }
  }
  
  return {
    interpretCommand,
    executeAction
  };
} 