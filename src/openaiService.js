const { OpenAI } = require('openai');
const chatService = require('./chatService');
const jiraService = require('./jiraService');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create a logging function
function logToFile(type, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        data
    };
    
    // Append to log file
    fs.appendFileSync(
        path.join(__dirname, '../logs/openai.log'), 
        JSON.stringify(logEntry, null, 2) + ',\n', 
        { flag: 'a+' }
    );
    
    // Also log to console for immediate feedback
    console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
}

// Clean JSON responses
function cleanJsonString(jsonString) {
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
function escapeCodeBlocks(text) {
    // Replace triple backticks with escaped versions
    return text.replace(/```/g, '\\`\\`\\`');
}

// Define the tools (functions) that OpenAI can call
const tools = [
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
    }
];

// Function to handle tool calls
async function handleToolCalls(toolCalls) {
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
                    // Map to our existing createIssue function in jiraService
                    result = await jiraService.createIssue({
                        projectKey: functionArgs.projectKey,
                        summary: functionArgs.summary,
                        description: functionArgs.description || "",
                        issueType: functionArgs.issueType,
                        parentKey: functionArgs.parentKey
                    });
                    break;
                case 'update_issue_type':
                    // Map to a new function we'll add to jiraService
                    result = await jiraService.updateIssueType(functionArgs);
                    break;
                case 'generate_technical_details':
                    // This is a special function that doesn't call Jira directly
                    // Instead, it uses the AI to generate detailed technical specifications
                    const issueDetails = await jiraService.getIssue(functionArgs);
                    
                    if (!issueDetails.success) {
                        result = { error: `Failed to get issue details: ${issueDetails.message}` };
                        break;
                    }
                    
                    // Generate detailed technical specifications using a separate AI call
                    const detailsResponse = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [
                            {
                                role: "system",
                                content: `You are a senior technical architect and product manager who specializes in creating comprehensive, high-quality Jira tickets.

Given a Jira ticket summary and any existing description, your job is to transform it into a complete, well-structured ticket that follows best practices.

Your response should include:

1. OVERVIEW
   - A clear, concise explanation of what needs to be built/fixed
   - The business context and value

2. TECHNICAL REQUIREMENTS
   - Detailed technical specifications
   - Suggested architecture/design patterns
   - Key components or classes needed
   - APIs or libraries that might be useful
   - Data models and storage considerations

3. IMPLEMENTATION DETAILS
   - Step-by-step approach to implementation
   - Code examples or pseudocode where helpful (but avoid using triple backtick syntax - use indentation instead)
   - Potential technical challenges and solutions

4. ACCEPTANCE CRITERIA
   - Clear, testable criteria that define when the work is complete
   - Edge cases to consider

5. TESTING CONSIDERATIONS
   - Types of tests needed (unit, integration, etc.)
   - Test scenarios to cover
   - Performance testing requirements if applicable

6. DEPENDENCIES & RISKS
   - Other systems or teams this work depends on
   - Potential risks and mitigation strategies

Format your response using Jira markdown for better readability (headings, bullet points, etc.).
IMPORTANT: Do not use triple backtick (\`\`\`) code blocks as they cause parsing issues. Use indentation for code examples instead.
Be specific, detailed, and practical - focus on information that will genuinely help the team implement this feature effectively.`
                            },
                            {
                                role: "user",
                                content: `Please transform this basic Jira ticket into a comprehensive, high-quality ticket following best practices:
                                
                                Issue Key: ${functionArgs.issueKey}
                                Summary: ${issueDetails.data.summary}
                                Current Description: ${issueDetails.data.description || "None"}
                                
                                Don't just add technical details - completely rewrite the description to make this a model Jira ticket that would impress senior management and give developers everything they need to implement it effectively.`
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 1000
                    });
                    
                    const technicalDetails = detailsResponse.choices[0].message.content;
                    
                    // Return the generated technical details
                    result = {
                        success: true,
                        message: "Generated technical details",
                        data: {
                            issueKey: functionArgs.issueKey,
                            technicalDetails: technicalDetails
                        }
                    };
                    break;
                default:
                    result = { error: `Unknown function: ${functionName}` };
            }
        } catch (error) {
            result = { error: error.message };
        }
        
        logToFile('TOOL_RESULT', { functionName, result });
        
        results.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(result)
        });
    }
    
    return results;
}

/**
 * Determines if the user's message is a context-only message or an action request
 * @param {string} text - The user's message
 * @returns {Promise<Object>} - The intent of the message
 */
async function determineIntent(text) {
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
        
        const intent = intentResponse.choices[0].message.content.trim();
        
        return { intent };
    } catch (error) {
        logToFile('INTENT_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Error determining intent:', error);
        
        // Default to ACTION if there's an error
        return { intent: 'ACTION' };
    }
}

/**
 * Interprets a voice command and converts it to a structured Jira action
 * @param {string} text - The transcribed voice command
 * @returns {Promise<Object>} - The structured Jira action
 */
async function interpretCommand(text) {
    try {
        // Get chat history
        const chatHistory = chatService.getMessages();
        
        // Check if this is a simple intent
        const intentResponse = await determineIntent(text);
        logToFile('INTENT_RESPONSE', { intent: intentResponse.intent });
        
        if (intentResponse.intent === 'CONTEXT_ONLY') {
            return {
                actionType: "storeContext",
                parameters: {
                    context: text
                }
            };
        }
        
        // Otherwise, proceed with normal action interpretation
        logToFile('ACTION_REQUEST', { text });
        
        // Build messages array for OpenAI
        const messages = [
            {
                role: "system",
                content: `You are an expert Jira assistant that helps users manage their projects effectively.

Your primary goal is to create high-quality Jira tickets that follow best practices and contain comprehensive information.

When creating or updating tickets:
1. Always aim to produce tickets that are clear, detailed, and actionable
2. Include acceptance criteria when appropriate
3. Add implementation details that would help developers understand the work
4. Consider adding information about dependencies, risks, and testing requirements
5. Use proper Jira formatting for better readability (headings, bullet points, etc.)

Don't just repeat what the user says - enhance it with your expertise. If the user provides minimal information, use your knowledge to flesh out the ticket with relevant details based on the context.

For technical tickets, include architecture considerations, potential approaches, and technical requirements.
For user stories, ensure they follow the "As a [user], I want [goal] so that [benefit]" format and include detailed acceptance criteria.

Available Jira actions:
- createIssue: Create a new Jira issue
- getIssue: Get details of a specific issue
- updateIssue: Update an existing issue
- searchIssues: Search for issues using JQL
- assignIssue: Assign an issue to a user
- addComment: Add a comment to an issue
- transitionIssue: Change the status of an issue

You can use the provided tools to get additional information when needed.

After gathering all necessary information, return a valid JSON object with the following structure:
{
    "actionType": "one of the action types above",
    "parameters": {
        // All parameters needed for the action
    }
}

IMPORTANT: Do not include any comments, explanations, or additional text in your final JSON response. The JSON must be valid and parseable.`
            }
        ];
        
        // Add chat history for context
        chatHistory.forEach(message => {
            messages.push({
                role: message.role,
                content: message.content
            });
        });
        
        // Add the current user message
        messages.push({
            role: "user",
            content: text
        });
        
        // Log the chat history being sent to OpenAI
        logToFile('CHAT_HISTORY', { 
            messageCount: chatHistory.length,
            messages: chatHistory.map(m => ({
                role: m.role,
                content: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : '')
            }))
        });
        
        // Process with potential multiple API calls for tool usage
        let finalResponse = null;
        let toolResults = [];
        const maxIterations = 10;
        let iterations = 0;
        
        // Track created issues for summary response
        const createdIssues = [];
        
        while (iterations < maxIterations) {
            iterations++;
            
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages,
                tools,
                tool_choice: "auto",
            });
            
            const responseMessage = response.choices[0].message;
            
            // If the model wants to call a function
            if (responseMessage.tool_calls) {
                logToFile('TOOL_CALLS_REQUESTED', { tool_calls: responseMessage.tool_calls });
                
                // Call the functions and collect results
                const results = await handleToolCalls(responseMessage.tool_calls);
                toolResults = toolResults.concat(results);
                
                // Add assistant message with tool calls
                messages.push(responseMessage);
                
                // Add tool results to messages
                messages.push({
                    role: "tool",
                    tool_call_id: results[0].tool_call_id,
                    content: results[0].output,
                });
                
                // Track created issues
                if (results[0].output) {
                    try {
                        const resultData = JSON.parse(results[0].output);
                        if (resultData.success && resultData.message && resultData.message.includes('created successfully')) {
                            createdIssues.push(resultData.data.key);
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
                
                // Check if we've created multiple issues and should return a summary
                if (createdIssues.length >= 3) {
                    // We've created enough issues, generate a summary response
                    finalResponse = JSON.stringify({
                        actionType: "createIssue",
                        parameters: {
                            summary: `Created Epic and subtasks: ${createdIssues.join(', ')}`,
                            result: {
                                success: true,
                                message: `Successfully created Epic and ${createdIssues.length - 1} subtasks: ${createdIssues.join(', ')}`,
                                data: {
                                    createdIssues: createdIssues
                                }
                            }
                        }
                    });
                    
                    break; // Exit the loop as we have our final action
                }
                
                // Check for technical details generation
                const technicalDetailsResult = toolResults.find(result => {
                    try {
                        const parsedOutput = JSON.parse(result.output);
                        return parsedOutput.data && parsedOutput.data.technicalDetails;
                    } catch (e) {
                        return false;
                    }
                });
                
                if (technicalDetailsResult) {
                    const parsedOutput = JSON.parse(technicalDetailsResult.output);
                    const { issueKey, technicalDetails } = parsedOutput.data;
                    
                    // Escape any code blocks in the technical details to prevent JSON parsing errors
                    const escapedDetails = escapeCodeBlocks(technicalDetails);
                    
                    // Automatically create an updateIssue action with the generated details
                    finalResponse = JSON.stringify({
                        actionType: "updateIssue",
                        parameters: {
                            issueKey: issueKey,
                            description: escapedDetails
                        }
                    });
                    
                    // Log that we're auto-generating an update action
                    logToFile('AUTO_GENERATING_UPDATE_ACTION', { 
                        issueKey, 
                        technicalDetailsLength: escapedDetails.length 
                    });
                    
                    break; // Exit the loop as we have our final action
                }
                
                // Continue the conversation
                continue;
            } else {
                // We have a final response
                finalResponse = responseMessage.content;
                break;
            }
        }
        
        // If we've reached max iterations but created issues, return a summary
        if (!finalResponse && createdIssues.length > 0) {
            finalResponse = JSON.stringify({
                actionType: "createIssue",
                parameters: {
                    summary: `Created Epic and subtasks: ${createdIssues.join(', ')}`,
                    result: {
                        success: true,
                        message: `Successfully created Epic and ${createdIssues.length - 1} subtasks: ${createdIssues.join(', ')}`,
                        data: {
                            createdIssues: createdIssues
                        }
                    }
                }
            });
        } else if (!finalResponse) {
            throw new Error("Failed to get a final response after maximum iterations");
        }
        
        logToFile('ACTION_RESPONSE_RAW', { responseContent: finalResponse });
        
        try {
            // Check if the response is a natural language error message
            if (finalResponse.trim().startsWith('I couldn\'t find') || 
                finalResponse.trim().startsWith('Sorry') ||
                finalResponse.trim().startsWith('Error') ||
                finalResponse.trim().startsWith('I need more information') ||
                finalResponse.trim().startsWith('To convert')) {
                
                // Convert the natural language error to a proper error action
                logToFile('CONVERTING_TO_ERROR_ACTION', { message: finalResponse });
                
                const errorAction = {
                    actionType: "error",
                    parameters: {
                        message: finalResponse
                    }
                };
                
                // Add the assistant's response to chat history
                chatService.addMessage('assistant', finalResponse, { action: errorAction });
                
                return errorAction;
            }
            
            // Clean the response content before parsing
            const cleanedContent = cleanJsonString(finalResponse);
            logToFile('ACTION_RESPONSE_CLEANED', { cleanedContent });
            
            const actionJson = JSON.parse(cleanedContent);
            logToFile('ACTION_RESPONSE_PARSED', { actionJson });
            
            // Add the assistant's response to chat history
            chatService.addMessage('assistant', finalResponse, { action: actionJson });
            
            return actionJson;
        } catch (parseError) {
            // Add more detailed error information
            logToFile('ACTION_PARSE_ERROR', { 
                error: parseError.message,
                errorPosition: parseError.message.match(/position (\d+)/)?.[1] || 'unknown',
                responseContent: finalResponse,
                cleanedContent: cleanJsonString(finalResponse),
                // Add a snippet around the error position if available
                errorContext: parseError.message.match(/position (\d+)/) 
                    ? finalResponse.substring(
                        Math.max(0, parseInt(parseError.message.match(/position (\d+)/)[1]) - 50),
                        Math.min(finalResponse.length, parseInt(parseError.message.match(/position (\d+)/)[1]) + 50)
                      ) 
                    : 'unknown'
            });
            
            // If we can't parse the response, try to extract the actual content
            // This is a special case for when we have a valid updateIssue action inside an error message
            if (finalResponse.includes('"actionType":"updateIssue"') && 
                finalResponse.includes('"description"')) {
                try {
                    // Try to extract the JSON from the error message
                    const match = finalResponse.match(/(\{.*\})/);
                    if (match) {
                        const extractedJson = match[1];
                        logToFile('EXTRACTED_JSON_FROM_ERROR', { extractedJson });
                        
                        const actionJson = JSON.parse(extractedJson);
                        logToFile('EXTRACTED_ACTION_PARSED', { actionJson });
                        
                        // Add the assistant's response to chat history
                        chatService.addMessage('assistant', extractedJson, { action: actionJson });
                        
                        return actionJson;
                    }
                } catch (extractError) {
                    logToFile('EXTRACT_JSON_ERROR', { error: extractError.message });
                }
            }
            
            // If we've created issues but can't parse the response, return a summary
            if (createdIssues.length > 0) {
                const summaryAction = {
                    actionType: "createIssue",
                    parameters: {
                        summary: `Created Epic and subtasks: ${createdIssues.join(', ')}`,
                        result: {
                            success: true,
                            message: `Successfully created Epic and ${createdIssues.length - 1} subtasks: ${createdIssues.join(', ')}`,
                            data: {
                                createdIssues: createdIssues
                            }
                        }
                    }
                };
                
                // Add the summary to chat history
                chatService.addMessage('assistant', JSON.stringify(summaryAction), { action: summaryAction });
                
                return summaryAction;
            }
            
            // If we can't parse the response, convert it to an error action
            const errorAction = {
                actionType: "error",
                parameters: {
                    message: finalResponse
                }
            };
            
            // Add the assistant's response to chat history
            chatService.addMessage('assistant', finalResponse, { action: errorAction });
            
            return errorAction;
        }
    } catch (error) {
        logToFile('COMMAND_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Error interpreting command:', error);
        throw new Error('Failed to interpret voice command');
    }
}

module.exports = {
    interpretCommand,
    determineIntent
}; 