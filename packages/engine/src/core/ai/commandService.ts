import { OpenAI } from "openai";
import { JIRA_TOOLS, SYSTEM_PROMPT } from "../../adapters/openai/prompts";
import { logger } from "../../utils/logger";
import { JiraService, ProjectMetadata } from "../jira";
import {
  ChatMessage,
  CreateAndLinkSubtasksParams,
  CreateEpicAndLinkParams,
  JiraActionParamsType,
  JiraContext,
  MoveToEpicParams,
  ToolFunctionProperty,
} from "./types";
import {
  convertJiraContextToText,
  createEnhancedPrompt,
} from "./utils/prompts.utils";
import { ChatCompletionTool } from "openai/resources";

export function configureCommandService(
  openai: OpenAI,
  jiraService: JiraService
) {
  // New function to fetch metadata for available fields
  async function fetchJiraMetadata(
    projectIdOrKey?: string
  ): Promise<ProjectMetadata | null> {
    try {
      if (!projectIdOrKey) {
        logger.info("No project key provided for metadata fetch");
        return null;
      }

      // First get all issue types for the project
      const issueTypesMetadata = await jiraService.getCreateMetadataIssueTypes(
        projectIdOrKey
      );
      logger.info(
        `Fetched ${
          issueTypesMetadata?.issueTypes?.length || 0
        } issue types for project ${projectIdOrKey}`
      );

      // Create a comprehensive metadata object with fields for each issue type
      const fullMetadata: ProjectMetadata = {
        projectKey: projectIdOrKey,
        issueTypes: [],
      };

      if (!issueTypesMetadata?.issueTypes?.length) {
        return fullMetadata; // Return what we have if no issue types found
      }

      // For each issue type, get its field metadata
      for (const issueType of issueTypesMetadata.issueTypes) {
        try {
          const fieldMetadata = await jiraService.getCreateFieldMetadata(
            projectIdOrKey,
            issueType.id
          );

          fullMetadata.issueTypes.push({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description,
            fields: fieldMetadata.fields,
            subtask: issueType.subtask,
          });

          logger.info(
            `Fetched field metadata for issue type ${issueType.name}`
          );
        } catch (error) {
          logger.warn(
            `Failed to fetch field metadata for issue type ${issueType.name}:`,
            error
          );
          // Still include the issue type but without detailed field info
          fullMetadata.issueTypes.push({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description,
            fields: [],
            subtask: issueType.subtask,
          });
        }
      }

      return fullMetadata;
    } catch (error) {
      logger.error("Error fetching Jira metadata:", error);
      return null;
    }
  }

  async function interpretCommand(
    text: string,
    context?: JiraContext,
    chatHistory?: ChatMessage[]
  ) {
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

      // Create a copy of the tools that we can modify
      let jiraTools = [...JIRA_TOOLS];

      // Fetch relevant Jira metadata if context contains project info
      let metadataInfo = "";
      if (context?.projectKey) {
        const projectMetadata = await fetchJiraMetadata(context.projectKey);
        logger.info("Project metadata:", projectMetadata);
        if (projectMetadata) {
          // Update the tools with the metadata
          jiraTools = updateToolsWithMetadata(jiraTools, projectMetadata);

          // Also include a brief summary of available issue types in the prompt
          metadataInfo = generateMetadataSummary(projectMetadata);
        }
      }
      // logger.info("---------------------------------");
      // logger.info("Jira tools:", JSON.stringify(jiraTools, null, 2));
      // logger.info("---------------------------------");
      // logger.info("Metadata info:", metadataInfo);
      // logger.info("---------------------------------");
      // throw new Error("STOP");

      // Call OpenAI with the enhanced prompt and tools
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(chatHistory || []),
          {
            role: "user",
            content: metadataInfo
              ? `${enhancedPrompt}\n\nAvailable Jira issue types:\n${metadataInfo}`
              : enhancedPrompt,
          },
        ],
        tools: jiraTools,
        tool_choice: "auto",
      });

      // Process the response
      const message = response.choices[0].message;

      // Handle tool calls
      logger.info("Tool calls:", message.tool_calls);
      const actions = message.tool_calls?.map((toolCall) => {
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
            return {
              actionType: "createIssue",
              parameters: args,
              approveRequired: true,
            };
          case "update_issue_type":
            return {
              actionType: "updateIssueType",
              parameters: {
                issueKey: args.issueKey,
                issueType: args.newIssueType,
              },
              approveRequired: true,
            };
          case "delete_issue":
            return {
              actionType: "deleteIssue",
              parameters: {
                issueKey: args.issueKey,
              },
              approveRequired: true,
            };
          case "add_comment":
            return {
              actionType: "addComment",
              parameters: args,
              approveRequired: true,
            };
          case "assign_issue":
            return {
              actionType: "assignIssue",
              parameters: args,
              approveRequired: true,
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
              approveRequired: true,
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
              approveRequired: true,
            };
          case "link_issues":
            return {
              actionType: "linkIssues",
              parameters: args,
              approveRequired: true,
            };
          case "update_issue":
            return {
              actionType: "updateIssue",
              parameters: args,
              approveRequired: true,
            };
          default:
            return {
              actionType: "message",
              parameters: {
                message: `I don't know how to perform the action: ${functionName}`,
              },
            };
        }
      });

      return {
        actionType: "message",
        parameters: {
          message: message.content || "I understood your request.",
          actions,
        },
      };
    } catch (error: unknown) {
      logger.error("Error interpreting command:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Error interpreting command: ${errorMessage}`);
    }
  }

  async function executeAction(
    action: JiraActionParamsType,
    context?: JiraContext
  ) {
    try {
      logger.info("Executing action:", action);

      switch (action.actionType) {
        case "getIssue":
          return jiraService.getIssue(action.parameters);

        case "searchIssues":
          return jiraService.searchIssues(action.parameters);

        case "createIssue":
          // Always enhance the description, whether provided or not
          try {
            const originalDescription = action.parameters.description || "";
            action.parameters.description = await enhanceDescription(
              action.parameters.issueType || "Task",
              action.parameters.summary,
              originalDescription,
              context
            );
          } catch (descError) {
            logger.warn("Failed to enhance description:", descError);
            // Continue with original description if enhancement fails
          }
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
          if (action.parameters.description) {
            try {
              const { data: issue } = await jiraService.getIssue({
                issueKey: action.parameters.issueKey,
              });
              const originalDescription = action.parameters.description || "";
              action.parameters.description = await enhanceDescription(
                action.parameters.issueType ||
                  issue?.fields.issuetype.name ||
                  "Task",
                action.parameters.summary || issue?.fields.summary || "",
                originalDescription,
                context
              );
            } catch (descError) {
              logger.warn("Failed to enhance description:", descError);
              // Continue with original description if enhancement fails
            }
          }
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

  async function createEpicAndLink(
    params: CreateEpicAndLinkParams,
    context?: JiraContext
  ) {
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

  async function createAndLinkSubtasks(
    params: CreateAndLinkSubtasksParams,
    context?: JiraContext
  ) {
    try {
      // Create multiple subtasks for a parent issue
      logger.info(
        `Creating ${params.subtasks.length} subtasks for parent issue ${params.parentIssueKey}`
      );

      // Get parent issue details to use the same project
      const { data: parentIssue } = await jiraService.getIssue({
        issueKey: params.parentIssueKey,
      });

      if (!parentIssue) {
        return {
          success: false,
          message: `Failed to get parent issue ${params.parentIssueKey}`,
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
          const { success, data: subtaskResult } =
            await jiraService.createIssue({
              projectKey,
              summary: subtask.summary,
              description:
                subtask.description || `Subtask for ${params.parentIssueKey}`,
              issueType: "Sub-task",
              parentIssueKey: params.parentIssueKey,
            });

          if (success && subtaskResult) {
            createdSubtasks.push(subtaskResult.key);

            // If assignee is specified, assign the subtask
            if (subtask.assignee) {
              try {
                await jiraService.assignIssue({
                  issueKey: subtaskResult.key,
                  accountId: subtask.assignee,
                });
              } catch (assignError) {
                logger.warn(
                  `Failed to assign subtask ${subtaskResult.key}:`,
                  assignError
                );
              }
            }
          } else {
            failedSubtasks.push(subtask.summary);
          }
        } catch (subtaskError) {
          logger.error(
            `Error creating subtask "${subtask.summary}":`,
            subtaskError
          );
          failedSubtasks.push(subtask.summary);
        }
      }

      // Generate result message
      let resultMessage = "";
      if (createdSubtasks.length > 0) {
        resultMessage += `Successfully created ${
          createdSubtasks.length
        } subtasks for ${params.parentIssueKey}: ${createdSubtasks.join(
          ", "
        )}. `;
      }

      if (failedSubtasks.length > 0) {
        resultMessage += `Failed to create ${
          failedSubtasks.length
        } subtasks: ${failedSubtasks.join(", ")}`;
      }

      return {
        success: createdSubtasks.length > 0,
        message: resultMessage,
        data: {
          issues: createdSubtasks.map((key) => ({ key })),
        },
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
              "You are a Jira expert who writes clear, detailed but short issue descriptions following best practices. Your descriptions are concise yet thorough, providing all necessary information without unnecessary details. You structure information logically with clear headings and bullet points for readability.",
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
      return await generateAIDescription(
        issueType,
        summary,
        context,
        chatHistory
      );
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
              "You are a Jira expert who improves issue descriptions while preserving their original content and intent. You restructure and enhance descriptions to follow best practices without changing the core information. You make the description more concise and clear.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      });

      const enhancedDescription =
        response.choices[0].message.content || originalDescription;
      return enhancedDescription;
    } catch (error) {
      logger.error("Error enhancing description:", error);
      // Return the original description if enhancement fails
      return originalDescription;
    }
  }

  // Function to update the tools with metadata
  function updateToolsWithMetadata(
    tools: ChatCompletionTool[],
    metadata: ProjectMetadata
  ) {
    // Create a deep copy of the tools array to avoid modifying the original
    const updatedTools = [...tools];

    // Find the create_issue and update_issue tools
    const toolToCreateIssue = updatedTools.find(
      (tool) =>
        tool.type === "function" && tool.function.name === "create_issue"
    );

    const toolToUpdateIssue = updatedTools.find(
      (tool) =>
        tool.type === "function" && tool.function.name === "update_issue"
    );

    if (toolToCreateIssue) {
      // Update the create_issue tool with metadata
      updateIssueTool(toolToCreateIssue, metadata);
    }

    if (toolToUpdateIssue) {
      // Update the update_issue tool with metadata
      updateIssueTool(toolToUpdateIssue, metadata);
    }

    return updatedTools;
  }

  // Function to update the create_issue tool
  function updateIssueTool(
    tool: ChatCompletionTool,
    metadata: ProjectMetadata
  ) {
    const properties: Record<string, ToolFunctionProperty> =
      (tool.function.parameters?.properties as Record<
        string,
        ToolFunctionProperty
      >) || {};

    // Update the issueType property with available issue types
    if (metadata.issueTypes.length > 0) {
      const issueTypeNames = metadata.issueTypes.map((type) => type.name);
      properties.issueType.enum = issueTypeNames;
      properties.issueType.description = `Type of issue. Available types: ${issueTypeNames.join(
        ", "
      )}`;

      // Add custom fields based on all issue types
      const customFields: Record<string, ToolFunctionProperty> = {};
      const customFieldDescriptions: Record<string, string[]> = {};

      metadata.issueTypes.forEach((issueType) => {
        if (issueType.fields && issueType.fields.length > 0) {
          issueType.fields.forEach((field) => {
            // Skip standard fields that are already in the schema
            if (
              ["summary", "description", "issuetype", "project"].includes(
                field.key
              )
            ) {
              return;
            }

            // Add custom field
            if (!customFields[field.key]) {
              let fieldType: ToolFunctionProperty["type"];
              switch (field.schema.type) {
                case "number":
                case "integer":
                  fieldType = "number";
                  break;
                default:
                  fieldType =
                    (field.schema.type as ToolFunctionProperty["type"]) ||
                    "string";
                  break;
              }

              customFields[field.key] = {
                name: field.key,
                type: fieldType,
                description: `${field.name} (${issueType.name}${
                  field.required ? ", Required" : ""
                })`,
                required: field.required,
              };

              // If it's an array, specify the items type
              if (fieldType === "array" && field.schema && field.schema.items) {
                logger.info("Field schema:", field.schema);
                customFields[field.key].items = {
                  type: "string",
                  description: "Items in the array",
                };
              }

              // If there are allowed values, add them as enum
              if (field.allowedValues && field.allowedValues.length > 0) {
                customFields[field.key].enum = field.allowedValues.map(
                  (value) => value.toString()
                );
              }

              // Track which issue types this field applies to
              customFieldDescriptions[field.key] = [
                `${issueType.name}${field.required ? " (Required)" : ""}`,
              ];
            } else {
              // Update description to show which issue types this field applies to
              customFieldDescriptions[field.key].push(
                `${issueType.name}${field.required ? " (Required)" : ""}`
              );
              customFields[field.key].description = `${
                field.name
              } (Applies to: ${customFieldDescriptions[field.key].join(", ")})`;
            }
          });
        }
      });

      // Add custom fields to the properties
      Object.keys(customFields).forEach((key) => {
        properties[key] = customFields[key];
      });
    }
  }

  // Function to generate a brief summary of available issue types
  function generateMetadataSummary(metadata: ProjectMetadata) {
    let summary = "";

    if (metadata.issueTypes && metadata.issueTypes.length > 0) {
      summary = metadata.issueTypes
        .map((type) => {
          let typeSummary = `- ${type.name}`;
          if (type.description) {
            typeSummary += `: ${type.description}`;
          }
          return typeSummary;
        })
        .join("\n");
    }

    return summary;
  }

  return {
    interpretCommand,
    executeAction,
    fetchJiraMetadata,
  };
}
