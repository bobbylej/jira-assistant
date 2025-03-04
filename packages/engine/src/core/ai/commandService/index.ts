import { OpenAI } from 'openai';
import { JIRA_TOOLS } from '../../../adapters/openai/prompts';
import { logger } from '../../../utils/logger';
import { toolCallHandlers } from './toolCallHandlers';
import { actionHandlers } from './actionHandlers';
import { Action, ActionResult } from './types';

export function configureCommandService(openai: OpenAI, jiraService: any) {
  // Create a map for faster lookups
  const toolCallHandlerMap = new Map(
    toolCallHandlers.map(handler => [handler.functionName, handler.handler])
  );
  
  const actionHandlerMap = new Map(
    actionHandlers.map(handler => [handler.actionType, handler.handler])
  );
  
  async function interpretCommand(text: string, context?: any): Promise<Action> {
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
        
        // Get the handler for this function name
        const handler = toolCallHandlerMap.get(functionName);
        
        if (handler) {
          return handler(args);
        }
        
        // Default handler for unknown functions
        return {
          actionType: 'message',
          parameters: {
            message: `I don't know how to perform the action: ${functionName}`
          }
        };
      }
      
      // Default to returning the message content
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
  
  async function executeAction(action: Action): Promise<ActionResult> {
    try {
      logger.info('Executing action:', action);
      
      // Get the handler for this action type
      const handler = actionHandlerMap.get(action.actionType);
      
      if (handler) {
        return await handler(action, { jiraService });
      }
      
      // Default handler for unknown action types
      return {
        success: false,
        message: `Unknown action type: ${action.actionType}`
      };
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

export * from './types'; 