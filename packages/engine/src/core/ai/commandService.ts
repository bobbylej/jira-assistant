import { OpenAI } from "openai";
import { JIRA_TOOLS, SYSTEM_PROMPT } from "../../adapters/openai/prompts";
import { logger } from "../../utils/logger";
import { JiraService } from "../jira";
import { ChatMessage, CreateAndLinkSubtasksParams, CreateEpicAndLinkParams, JiraActionParamsType, JiraContext, MoveToEpicParams } from "./types";

export function configureCommandService(
  openai: OpenAI,
  jiraService: JiraService
) {
  /**
   * Converts a JiraContext object into a descriptive text format
   * that's easier for the AI to understand and utilize
   */
  function convertJiraContextToText(context: JiraContext | null): string {
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
            context.comments[context.comments.length - 1].text.substring(
              0,
              100
            ) +
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
  function createEnhancedPrompt(
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

  async function interpretCommand(text: string, context?: JiraContext, chatHistory?: ChatMessage[]) {
    try {
      logger.info("Interpreting command:", text);

      // Convert Jira context to text format
      const contextText = context ? convertJiraContextToText(context) : "";

      // Create enhanced prompt with user text and context
      const enhancedPrompt = contextText
        ? createEnhancedPrompt(text, contextText)
        : text;

      logger.info("Chat history:", chatHistory);
      logger.info("Enhanced prompt:", enhancedPrompt);

      // Command interpretation logic using OpenAI function calling
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...(chatHistory || []),
          { role: "user", content: enhancedPrompt },
        ],
        tools: JIRA_TOOLS,
        temperature: 0.5,
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
          case "get_issue":
            return {
              actionType: "getIssue",
              parameters: args,
            };
          case "search_issues":
            return {
              actionType: "searchIssues",
              parameters: args,
            };
          case "create_issue":
            // Always enhance the description, whether provided or not
            try {
              const originalDescription = args.description || "";
              args.description = await enhanceDescription(
                args.issueType || "Task",
                args.summary,
                originalDescription,
                context
              );
            } catch (descError) {
              logger.warn("Failed to enhance description:", descError);
              // Continue with original description if enhancement fails
            }

            return {
              actionType: "createIssue",
              parameters: args,
            };
          case "update_issue_type":
            return {
              actionType: "updateIssueType",
              parameters: {
                issueKey: args.issueKey,
                issueType: args.newIssueType,
              },
            };
          case "delete_issue":
            return {
              actionType: "deleteIssue",
              parameters: {
                issueKey: args.issueKey,
              },
            };
          case "add_comment":
            return {
              actionType: "addComment",
              parameters: args,
            };
          case "assign_issue":
            return {
              actionType: "assignIssue",
              parameters: args,
            };
          case "get_issue_transitions":
            return {
              actionType: "getIssueTransitions",
              parameters: args,
            };
          case "transition_issue":
            return {
              actionType: "transitionIssue",
              parameters: args,
            };
          case "get_project_users":
            return {
              actionType: "getProjectUsers",
              parameters: args,
            };
          case "update_issue_priority":
            return {
              actionType: "updateIssuePriority",
              parameters: args,
            };
          case "link_issues":
            return {
              actionType: "linkIssues",
              parameters: args,
            };
          case "multi_step_operation":
            return {
              actionType: "multiStepOperation",
              parameters: args,
            };
          case "update_issue":
            // Only enhance the description if it's explicitly provided
            if (args.description) {
              try {
                // Get the issue type if available
                let issueType = args.issueType;
                if (!issueType && args.issueKey) {
                  try {
                    const { data: issue } = await jiraService.getIssue({
                      issueKey: args.issueKey,
                    });
                    issueType = issue?.fields.issuetype.name;
                  } catch (error) {
                    logger.warn(
                      `Could not get issue type for ${args.issueKey}:`,
                      error
                    );
                  }
                }

                args.description = await enhanceDescription(
                  issueType || "Task",
                  args.summary || "",
                  args.description,
                  context
                );
              } catch (descError) {
                logger.warn("Failed to enhance description:", descError);
                // Continue with original description if enhancement fails
              }
            }

            return {
              actionType: "updateIssue",
              parameters: args,
            };
          default:
            return {
              actionType: "message",
              parameters: {
                message: `I don't know how to perform the action: ${functionName}`,
              },
            };
        }
      }

      return {
        actionType: "message",
        parameters: {
          message: message.content || "I understood your request.",
        },
      };
    } catch (error: unknown) {
      logger.error("Error interpreting command:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Error interpreting command: ${errorMessage}`);
    }
  }

  async function executeAction(action: JiraActionParamsType, context?: JiraContext) {
    try {
      logger.info("Executing action:", action);

      switch (action.actionType) {
        case "getIssue":
          return jiraService.getIssue(action.parameters);

        case "searchIssues":
          return jiraService.searchIssues(action.parameters);

        case "createIssue":
          return jiraService.createIssue(action.parameters);

        case "updateIssueType":
          return jiraService.updateIssueType(action.parameters);

        case "deleteIssue":
          return await jiraService.deleteIssue(action.parameters);

        case "addComment":
          await jiraService.addComment(action.parameters);
          return {
            success: true,
            message: `Successfully added comment to issue ${action.parameters.issueKey}`,
          };

        case "assignIssue":
          await jiraService.assignIssue(action.parameters);
          return {
            success: true,
            message: `Successfully assigned issue ${action.parameters.issueKey}`,
          };

        case "getIssueTransitions":
          const transitions = await jiraService.getIssueTransitions(
            action.parameters
          );
          let transitionsMessage = `Available transitions for ${action.parameters.issueKey}:\n\n`;

          transitions.transitions.forEach((transition: any, index: number) => {
            transitionsMessage += `${index + 1}. ID: ${transition.id}, Name: ${
              transition.name
            }\n`;
          });

          return {
            success: true,
            message: transitionsMessage,
          };

        case "transitionIssue":
          await jiraService.transitionIssue(action.parameters);
          return {
            success: true,
            message: `Successfully transitioned issue ${action.parameters.issueKey}`,
          };

        case "getProjectUsers":
          const users = await jiraService.getProjectUsers(action.parameters);
          let usersMessage = `Users for project ${action.parameters.projectKey}:\n\n`;

          users.forEach((user: any, index: number) => {
            usersMessage += `${index + 1}. Name: ${
              user.displayName
            }, Account ID: ${user.accountId}\n`;
          });

          return {
            success: true,
            message: usersMessage,
          };

        case "updateIssuePriority":
          return jiraService.updateIssuePriority(action.parameters);

        case "linkIssues":
          return jiraService.linkIssues(action.parameters);

        case "createEpicAndLink":
          return createEpicAndLink(action.parameters, context);

        case "createAndLinkSubtasks":
          return createAndLinkSubtasks(action.parameters, context);

        case "moveToEpic":
          return moveToEpic(action.parameters);

        case "updateIssue":
          return jiraService.updateIssue(action.parameters);

        case "message":
          return {
            success: true,
            message: action.parameters.message,
          };

        default:
          return {
            success: false,
            message: `Unknown action type: ${action.actionType}`,
          };
      }
    } catch (error: unknown) {
      logger.error("Error executing action:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Error executing action: ${errorMessage}`,
      };
    }
  }

  async function createEpicAndLink(params: CreateEpicAndLinkParams, context?: JiraContext) {
    try {
      // Enhance the epic description if provided, or generate a new one
      const originalDescription = params.epicDescription || "";
      try {
        params.epicDescription = await enhanceDescription(
          "Epic",
          params.epicSummary,
          originalDescription,
          context
        );
      } catch (descError) {
        logger.warn("Failed to enhance epic description:", descError);
        // Continue with original description if enhancement fails
      }

      // Step 1: Create the epic
      logger.info(
        `Creating epic "${params.epicSummary}" in project ${params.projectKey}`
      );
      const { success, data: epicResult } = await jiraService.createIssue({
        projectKey: params.projectKey,
        summary: params.epicSummary,
        description: params.epicDescription,
        issueType: "Epic",
      });

      if (!success || !epicResult) {
        return {
          success: false,
          message: "Failed to create epic",
        };
      }

      // Step 2: Link the issue to the epic if specified
      if (params.issueKey) {
        try {
          logger.info(
            `Linking issue ${params.issueKey} to new epic ${epicResult.key}`
          );

          // Wait a moment to ensure the epic is fully created in Jira
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await jiraService.linkIssues({
            sourceIssueKey: params.issueKey,
            targetIssueKey: epicResult.key,
            linkType: "is part of",
          });

          return {
            success: true,
            message: `Successfully created epic ${epicResult.key} "${params.epicSummary}" and linked issue ${params.issueKey} to it`,
          };
        } catch (linkError: any) {
          // If linking fails, still return success for the epic creation
          logger.error(`Failed to link issue to epic: ${linkError}`);

          // Add a comment to the issue mentioning the epic
          try {
            await jiraService.addComment({
              issueKey: params.issueKey,
              comment: `This issue should be part of Epic ${epicResult.key}. Automatic linking failed.`,
            });
          } catch (commentError) {
            logger.error(`Failed to add comment: ${commentError}`);
          }

          return {
            success: true,
            message: `Created epic ${epicResult.key} "${params.epicSummary}" but failed to link issue ${params.issueKey} to it. A reference comment was added instead.`,
          };
        }
      } else {
        return {
          success: true,
          message: `Successfully created epic ${epicResult.key} "${params.epicSummary}"`,
        };
      }
    } catch (error) {
      logger.error("Error in createEpicAndLink operation:", error);
      throw error;
    }
  }

  async function createAndLinkSubtasks(params: CreateAndLinkSubtasksParams, context?: JiraContext) {
    try {
      // Create multiple subtasks for a parent issue
      logger.info(
        `Creating ${params.subtasks.length} subtasks for parent issue ${params.parentIssueKey}`
      );
      
      // Get parent issue details to use the same project
      const { data: parentIssue } = await jiraService.getIssue({
        issueKey: params.parentIssueKey
      });
      
      if (!parentIssue) {
        return {
          success: false,
          message: `Failed to get parent issue ${params.parentIssueKey}`
        };
      }
      
      const projectKey = params.projectKey;
      const createdSubtasks = [];
      const failedSubtasks = [];
      
      // Create each subtask
      for (const subtask of params.subtasks) {
        try {
          // Enhance description if provided
          if (subtask.description) {
            try {
              subtask.description = await enhanceDescription(
                "Sub-task",
                subtask.summary,
                subtask.description,
                context
              );
            } catch (descError) {
              logger.warn("Failed to enhance subtask description:", descError);
              // Continue with original description
            }
          }
          
          // Create the subtask
          const { success, data: subtaskResult } = await jiraService.createIssue({
            projectKey,
            summary: subtask.summary,
            description: subtask.description || `Subtask for ${params.parentIssueKey}`,
            issueType: "Sub-task",
            parentIssueKey: params.parentIssueKey
          });
          
          if (success && subtaskResult) {
            createdSubtasks.push(subtaskResult.key);
            
            // If assignee is specified, assign the subtask
            if (subtask.assignee) {
              try {
                await jiraService.assignIssue({
                  issueKey: subtaskResult.key,
                  accountId: subtask.assignee
                });
              } catch (assignError) {
                logger.warn(`Failed to assign subtask ${subtaskResult.key}:`, assignError);
              }
            }
          } else {
            failedSubtasks.push(subtask.summary);
          }
        } catch (subtaskError) {
          logger.error(`Error creating subtask "${subtask.summary}":`, subtaskError);
          failedSubtasks.push(subtask.summary);
        }
      }
      
      // Generate result message
      let resultMessage = "";
      if (createdSubtasks.length > 0) {
        resultMessage += `Successfully created ${createdSubtasks.length} subtasks for ${params.parentIssueKey}: ${createdSubtasks.join(", ")}. `;
      }
      
      if (failedSubtasks.length > 0) {
        resultMessage += `Failed to create ${failedSubtasks.length} subtasks: ${failedSubtasks.join(", ")}`;
      }
      
      return {
        success: createdSubtasks.length > 0,
        message: resultMessage,
        data: {
          issues: createdSubtasks.map(key => ({ key }))
        }
      };
    } catch (error) {
      logger.error("Error in createAndLinkSubtasks operation:", error);
      throw error;
    }
  }

  async function moveToEpic(params: MoveToEpicParams) {
    try {
      // Link an existing issue to an existing epic
      logger.info(
        `Linking issue ${params.issueKey} to epic ${params.targetEpicKey}`
      );
      await jiraService.linkIssues({
        sourceIssueKey: params.issueKey,
        targetIssueKey: params.targetEpicKey,
        linkType: "is part of",
      });

      return {
        success: true,
        message: `Successfully linked issue ${params.issueKey} to epic ${params.targetEpicKey}`,
      };
    } catch (error) {
      logger.error("Error in moveToEpic operation:", error);
      throw error;
    }
  }

  // Add this function to generate AI-powered descriptions
  async function generateAIDescription(
    issueType: string,
    summary: string,
    context?: JiraContext,
    chatHistory?: any[]
  ): Promise<string> {
    try {
      // Create a prompt for the AI to generate a description based on best practices
      let prompt = `Generate a detailed description for a Jira ${issueType} with the summary: "${summary}".

Following best practices for Jira ticketing:
1. The description should be clear and factual, avoiding ambiguity
2. Include all essential information needed to understand and complete the work
3. Structure the description with clear sections using headings
4. Minimize references to external documents - include the necessary information directly
5. Use screenshots or visual aids when appropriate (mention where they would be helpful)
6. Focus on the "what" not the "how" - describe requirements, not implementation details
7. Acknowledge any uncertainties or open questions that need resolution

`;

      // Add context information if available
      if (context) {
        prompt += `\n\nCurrent context: ${JSON.stringify(context)}`;
      }

      // Add chat history if available
      if (chatHistory && chatHistory.length > 0) {
        prompt += `\n\nRecent conversation:`;
        // Include up to 5 most recent messages
        const recentMessages = chatHistory.slice(-5);
        recentMessages.forEach((msg) => {
          prompt += `\n- ${msg.role}: ${msg.content}`;
        });
      }

      // Add specific guidance based on issue type
      switch (issueType.toLowerCase()) {
        case "epic":
          prompt += `\n\nFor an Epic, include these sections:
- Overview: A high-level summary explaining the purpose of this epic
- Goals: What this epic aims to achieve (business objectives)
- Scope: What's included and what's explicitly out of scope
- Success Criteria: Specific, measurable conditions that define when this epic is complete
- Dependencies: Any other work this epic depends on or that depends on this epic
- Stakeholders: Who has interest in or influence over this epic

Remember that Epics should be treated as "chapters" in your project's story, providing context for the smaller stories and tasks within.`;
          break;

        case "story":
          prompt += `\n\nFor a User Story, include these sections:
- User Story Statement: "As a [type of user], I want [goal] so that [benefit]"
- Overview: Brief context about why this story matters
- Acceptance Criteria: Specific, testable conditions that must be met (use bullet points)
- Technical Notes: Any technical considerations that might impact implementation
- Dependencies: Any other stories or tasks this depends on
- Out of Scope: Explicitly state what is NOT included to prevent scope creep

Remember that Stories should be user-centric narratives that deliver specific value to the end-user.`;
          break;

        case "bug":
          prompt += `\n\nFor a Bug, include these sections:
- Bug Description: Clear statement of what's happening
- Steps to Reproduce: Numbered list of exact steps to recreate the issue
- Expected Behavior: What should happen when following these steps
- Actual Behavior: What actually happens instead
- Environment: Where this occurs (browser, OS, device, etc.)
- Impact: How this affects users (critical, major, minor)
- Screenshots/Videos: Mention where visual evidence would be helpful
- Possible Causes: Any initial thoughts on what might be causing this (if known)

Remember that Bug titles should specify the who/what/where/how of the problem.`;
          break;

        default: // Task or any other type
          prompt += `\n\nFor a Task, include these sections:
- Overview: Brief explanation of what this task involves
- Request: Detailed description of what needs to be done
- Acceptance Criteria: Specific conditions that must be met for this task to be complete
- Resources: Any helpful references or documentation
- Dependencies: Any other tasks this depends on
- Notes: Any additional information that might be helpful

Remember that Tasks should have titles that start with a verb (e.g., "Build", "Configure", "Implement").`;
          break;
      }

      logger.info("[INFO] Generated prompt:", prompt);
      // Call the AI to generate the description
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a Jira expert who writes clear, detailed issue descriptions following best practices. Your descriptions are concise yet thorough, providing all necessary information without unnecessary details. You structure information logically with clear headings and bullet points for readability.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      logger.error("Error generating AI description:", error);
      // Return a basic template if AI generation fails
      return `Description for ${issueType}: ${summary}`;
    }
  }

  // Add a new function to enhance descriptions
  async function enhanceDescription(
    issueType: string,
    summary: string,
    originalDescription: string,
    context?: JiraContext,
    chatHistory?: any[]
  ): Promise<string> {
    // If no original description, generate a new one
    if (!originalDescription || originalDescription.trim() === "") {
      return generateAIDescription(issueType, summary, context, chatHistory);
    }

    try {
      // Create a prompt for the AI to enhance the existing description
      let prompt = `Enhance the following Jira ${issueType} description for the issue with summary: "${summary}".

Original description:
"""
${originalDescription}
"""

Please improve this description following these best practices:
1. Preserve all factual information from the original description
2. Structure the content with clear sections using headings
3. Ensure all essential information is included and clearly presented
4. Add any missing sections that would be helpful based on the issue type
5. Format lists as bullet points or numbered steps where appropriate
6. Keep the original intent and meaning intact

`;

      // Add context information if available
      if (context) {
        prompt += `\n\nCurrent context: ${JSON.stringify(context)}`;
      }

      // Add specific guidance based on issue type
      switch (issueType.toLowerCase()) {
        case "epic":
          prompt += `\n\nFor an Epic, ensure these sections are included:
- Overview
- Goals
- Scope
- Success Criteria
- Dependencies (if any)
- Stakeholders (if known)`;
          break;

        case "story":
          prompt += `\n\nFor a User Story, ensure these sections are included:
- User Story Statement ("As a [user], I want [goal] so that [benefit]")
- Overview
- Acceptance Criteria
- Technical Notes (if applicable)
- Dependencies (if any)`;
          break;

        case "bug":
          prompt += `\n\nFor a Bug, ensure these sections are included:
- Bug Description
- Steps to Reproduce
- Expected Behavior
- Actual Behavior
- Environment
- Impact`;
          break;

        default: // Task or any other type
          prompt += `\n\nFor a Task, ensure these sections are included:
- Overview
- Request details
- Acceptance Criteria
- Dependencies (if any)`;
          break;
      }

      logger.info("[INFO] Generated enhancement prompt:", prompt);

      // Call the AI to enhance the description
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a Jira expert who improves issue descriptions while preserving their original content and intent. You restructure and enhance descriptions to follow best practices without changing the core information.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      });

      return response.choices[0].message.content || originalDescription;
    } catch (error) {
      logger.error("Error enhancing description:", error);
      // Return the original description if enhancement fails
      return originalDescription;
    }
  }

  return {
    interpretCommand,
    executeAction,
  };
}
