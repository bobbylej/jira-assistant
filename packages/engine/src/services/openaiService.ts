import { OpenAI } from 'openai';
import * as chatService from './chatService';
import * as jiraService from './jiraService';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat';

// Types
export interface Action {
  actionType: string;
  parameters: Record<string, any>;
}

// Create a logging function
function logToFile(type: string, data: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    data
  };
  
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Append to log file
  fs.appendFileSync(
    path.join(logsDir, 'openai.log'), 
    JSON.stringify(logEntry, null, 2) + ',\n', 
    { flag: 'a+' }
  );
  
  // Also log to console for immediate feedback
  console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
}

// Clean JSON responses
function cleanJsonString(jsonString: string): string {
  // Remove JavaScript-style comments (both single-line and multi-line)
  const withoutComments = jsonString
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
  
  // Attempt to fix any trailing commas (which are valid in JavaScript but not in JSON)
  const fixedTrailingCommas = withoutComments
    .replace(/,\s*}/g, '}')
    .replace(/,\s*\]/g, ']');
  
  return fixedTrailingCommas;
}

// Add this function to properly escape code blocks in JSON strings
function escapeCodeBlocks(text: string): string {
  // Replace triple backticks with escaped versions
  return text.replace(/```/g, '\\`\\`\\`');
}

const tools: ChatCompletionTool[] = [
  {
      type: "function",
      function: {
          name: "get_issue_details",
          description: "Get details about a specific Jira issue by its key",
          parameters: {
              type: "object",
              properties: {
                  issueKey: {
                      type: "string",
                      description: "The Jira issue key (e.g., PROJ-123)"
                  }
              },
              required: ["issueKey"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "search_issues",
          description: "Search for Jira issues using JQL (Jira Query Language)",
          parameters: {
              type: "object",
              properties: {
                  jql: {
                      type: "string",
                      description: "JQL query string (e.g., 'project = PROJ AND status = Open')"
                  },
                  maxResults: {
                      type: "integer",
                      description: "Maximum number of results to return"
                  }
              },
              required: ["jql"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "get_project_info",
          description: "Get information about a Jira project",
          parameters: {
              type: "object",
              properties: {
                  projectKey: {
                      type: "string",
                      description: "The Jira project key (e.g., PROJ)"
                  }
              },
              required: ["projectKey"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "generate_technical_details",
          description: "Generate detailed technical specifications for implementing a feature based on its summary",
          parameters: {
              type: "object",
              properties: {
                  issueKey: {
                      type: "string",
                      description: "The Jira issue key (e.g., PROJ-123)"
                  },
                  summary: {
                      type: "string",
                      description: "The summary or title of the issue"
                  },
                  currentDescription: {
                      type: "string",
                      description: "The current description of the issue, if any"
                  }
              },
              required: ["issueKey", "summary"]
          }
      }
  },
  // Add the missing createIssue function
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
                      description: "The project key where the issue will be created"
                  },
                  summary: {
                      type: "string",
                      description: "The summary/title of the issue"
                  },
                  description: {
                      type: "string",
                      description: "The description of the issue"
                  },
                  issueType: {
                      type: "string",
                      description: "The type of issue (e.g., Bug, Story, Task, Epic)"
                  },
                  parentKey: {
                      type: "string",
                      description: "The parent issue key for sub-tasks or stories under epics"
                  }
              },
              required: ["projectKey", "summary", "issueType"]
          }
      }
  },
  // Add update issue type function
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
                      description: "The Jira issue key to update"
                  },
                  newIssueType: {
                      type: "string",
                      description: "The new issue type (e.g., Epic, Story, Task, Bug)"
                  }
              },
              required: ["issueKey", "newIssueType"]
          }
      }
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
            description: "The Jira issue key (e.g., PROJ-123)"
          },
          confirmDelete: {
            type: "boolean",
            description: "Confirmation that the issue should be deleted"
          }
        },
        required: ["issueKey", "confirmDelete"]
      }
    }
  }
];

export function configureOpenAIService(apiKey: string, jiraService: any) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });

  // Track created issues during a conversation
  let createdIssues: string[] = [];

  // Move handleToolCalls inside configureOpenAIService
  async function handleToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      logToFile('TOOL_CALL', { functionName, functionArgs });
      
      let result;
      
      try {
        switch (functionName) {
          case 'get_issue_details':
            result = await jiraService.getIssue(functionArgs);
            break;
          case 'search_issues':
            result = await jiraService.searchIssues(functionArgs);
            break;
          case 'get_project_info':
            result = await jiraService.getProjectInfo(functionArgs);
            break;
          case 'create_issue':
            result = await jiraService.createIssue(functionArgs);
            // Track created issues
            if (result.success && result.data && result.data.key) {
              createdIssues.push(result.data.key);
            }
            break;
          case 'delete_issue':
            const { issueKey, confirmDelete } = functionArgs as { issueKey: string; confirmDelete: boolean };
            
            if (!confirmDelete) {
              result = {
                success: false,
                message: "Delete operation was not confirmed. Please confirm to proceed with deletion."
              };
            } else {
              result = await jiraService.deleteIssue(issueKey);
            }
            break;
          default:
            result = { error: `Unknown function: ${functionName}` };
        }
      } catch (error: any) {
        result = { 
          error: `Error executing ${functionName}: ${error.message}`,
          details: error.stack
        };
      }
      
      logToFile('TOOL_RESULT', { functionName, result });
      
      results.push({
        tool_call_id: toolCall.id,
        result
      });
    }
    
    return results;
  }

  async function determineIntent(text: string): Promise<{ intent: string }> {
    try {
      // Log the user's message
      logToFile('COMMAND_INPUT', { text });
      
      // Add the user message to chat history
      chatService.addMessage('user', text);
      
      // First, determine if this is a context-only message or an action request
      logToFile('INTENT_REQUEST', { text });
      
      const intentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a Jira assistant that helps users manage their projects. Your job is to determine if the user's message requires a Jira action or is just providing context for future actions.

Respond with only one of these values:
- ACTION: If the user is asking you to perform a specific Jira action (create, update, search, etc.)
- CONTEXT_ONLY: If the user is just providing information or context without requesting a specific action

Examples:
User: "Create a new bug ticket for the login page"
Response: ACTION

User: "I'm working on a new feature for the dashboard"
Response: CONTEXT_ONLY`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });
      
      const intent = intentResponse.choices[0]?.message?.content?.trim() ?? '';
      
      return { intent };
    } catch (error: any) {
      logToFile('INTENT_ERROR', { 
        error: error.message,
        stack: error.stack
      });
      console.error('Error determining intent:', error);
      
      // Default to ACTION if there's an error
      return { intent: 'ACTION' };
    }
  }

  async function interpretCommand(text: string): Promise<Action> {
    try {
      // Log the user's message
      logToFile('COMMAND_INPUT', { text });
      
      // Add the user message to chat history
      chatService.addMessage('user', text);
      
      // Get chat history
      const messages = chatService.getMessages();
      logToFile('CHAT_HISTORY', { 
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content.substring(0, 30) + (m.content.length > 30 ? '...' : '')
        }))
      });
      
      // Convert chat history to OpenAI format
      const chatHistory: ChatCompletionMessageParam[] = messages.map(msg => {
        // Handle different message types
        if (msg.role === 'user') {
          return { role: 'user', content: msg.content };
        } else if (msg.role === 'assistant') {
          // Check if this message has tool calls
          if (msg.metadata && msg.metadata.tool_calls) {
            return {
              role: 'assistant',
              content: null,
              tool_calls: msg.metadata.tool_calls
            };
          } else {
            return { role: 'assistant', content: msg.content };
          }
        } else if (msg.role === 'tool') {
          // Make sure tool responses are properly formatted
          return {
            role: 'tool',
            tool_call_id: msg.metadata.tool_call_id,
            content: msg.content
          };
        }
        
        // Default case
        return { role: 'user', content: msg.content };
      });
      
      // First, determine if this is a context-only message or an action request
      const intentResponse = await determineIntent(text);
      
      if (intentResponse.intent === 'CONTEXT') {
        // This is just context, not an action request
        return {
          actionType: 'storeContext',
          parameters: { context: text }
        };
      }
      
      // This is an action request, interpret it
      logToFile('ACTION_REQUEST', { text });
      
      // Create a system message
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are a Jira assistant that helps users manage their Jira tickets through voice commands. 
        Interpret the user's request and call the appropriate function to help them.
        Always respond with a function call when possible.`
      };
      
      // Create the messages array with system message and user's latest message
      const apiMessages: ChatCompletionMessageParam[] = [
        systemMessage,
        ...chatHistory
      ];
      
      // Make the API call
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: apiMessages,
        tools: tools,
        tool_choice: "auto"
      });
      
      const responseMessage = response.choices[0].message;
      
      // Check if the model wants to use a tool
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Log the tool calls
        logToFile('TOOL_CALLS_REQUESTED', { tool_calls: responseMessage.tool_calls });
        
        // Add the assistant's message with tool calls to chat history
        chatService.addMessage('assistant', '', { tool_calls: responseMessage.tool_calls });
        
        // Process each tool call
        const toolResults = await handleToolCalls(responseMessage.tool_calls);
        
        // Add tool results to chat history
        for (const result of toolResults) {
          chatService.addMessage('tool', JSON.stringify(result.result), { 
            tool_call_id: result.tool_call_id 
          });
        }
        
        // Get the final response from the model
        const secondResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            systemMessage,
            ...chatHistory,
            responseMessage,
            ...toolResults.map(result => ({
              role: 'tool' as const,
              tool_call_id: result.tool_call_id,
              content: JSON.stringify(result.result)
            }))
          ]
        });
        
        const finalResponse = secondResponse.choices[0].message.content || '';
        logToFile('FINAL_RESPONSE', { finalResponse });
        
        // Try to parse the response as JSON
        try {
          // Clean up the response to handle potential formatting issues
          const cleanedResponse = cleanJsonString(finalResponse);
          logToFile('CLEANED_RESPONSE', { cleanedResponse });
          
          // Try to parse as JSON
          const actionJson = JSON.parse(cleanedResponse);
          logToFile('ACTION_PARSED', { actionJson });
          
          // Add the assistant's response to chat history
          chatService.addMessage('assistant', finalResponse, { action: actionJson });
          
          return actionJson;
        } catch (parseError: any) {
          logToFile('PARSE_ERROR', { 
            error: parseError.message, 
            response: finalResponse 
          });
          
          // If we can't parse it as JSON, return it as a message action
          const messageAction = {
            actionType: "message",
            parameters: {
              message: finalResponse
            }
          };
          
          // Add the assistant's response to chat history
          chatService.addMessage('assistant', finalResponse, { action: messageAction });
          
          logToFile('MESSAGE_ACTION_CREATED', { messageAction });
          
          return messageAction;
        }
      } else {
        // No tool calls, just return the response as an action
        const content = responseMessage.content || '';
        
        try {
          // Try to parse the response as JSON
          const cleanedResponse = cleanJsonString(content);
          const actionJson = JSON.parse(cleanedResponse);
          
          // Add the assistant's response to chat history
          chatService.addMessage('assistant', content, { action: actionJson });
          
          return actionJson;
        } catch (parseError) {
          // If we can't parse it as JSON, return it as a message
          const messageAction = {
            actionType: "message",
            parameters: {
              message: content
            }
          };
          
          // Add the assistant's response to chat history
          chatService.addMessage('assistant', content, { action: messageAction });
          
          return messageAction;
        }
      }
    } catch (error: any) {
      logToFile('COMMAND_ERROR', { 
        error: error.message,
        stack: error.stack
      });
      console.error('Error interpreting command:', error);
      throw new Error('Failed to interpret voice command');
    }
  }

  async function executeAction(action: Action): Promise<any> {
    // Implementation of executeAction
  }

  return {
    determineIntent,
    interpretCommand,
    executeAction
  };
} 