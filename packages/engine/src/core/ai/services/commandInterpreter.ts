import { OpenAI } from "openai";
import { JIRA_TOOLS, SYSTEM_PROMPT } from "../../../adapters/openai/prompts";
import { logger } from "../../../utils/logger";
import { ChatMessage, JiraContext } from "../types";
import {
  convertJiraContextToText,
  createEnhancedPrompt,
} from "../utils/prompts.utils";
import { MetadataService } from "./metadataService";
import { AIProvider } from "../../../adapters/ai/types";

export function configureCommandInterpreter(
  aiClient: AIProvider,
  metadataService: MetadataService
) {
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
        const projectMetadata = await metadataService.fetchJiraMetadata(
          context.projectKey
        );

        if (projectMetadata) {
          // Update the tools with the metadata
          jiraTools = metadataService.updateToolsWithMetadata(
            jiraTools,
            projectMetadata
          );

          // Also include a brief summary of available issue types in the prompt
          metadataInfo =
            metadataService.generateMetadataSummary(projectMetadata);
        }
      }

      logger.info(
        "Message to send to OpenAI:",
        JSON.stringify([
          { role: "system", content: SYSTEM_PROMPT },
          ...(chatHistory || []),
          {
            role: "user",
            content: metadataInfo
              ? `${enhancedPrompt}\n\nAvailable Jira issue types:\n${metadataInfo}`
              : enhancedPrompt,
          },
        ])
      );

      // Call AI with the enhanced prompt and tools
      const response = await aiClient.createChatCompletion({
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
      logger.info("Tool calls:", JSON.stringify(message.tool_calls));
      const actions = message.tool_calls?.map((toolCall) => {
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments;

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
        }
        switch (true) {
          case functionName.startsWith("create"):
            return {
              actionType: "createIssue",
              parameters: args,
              approveRequired: true,
            };
          case functionName.startsWith("update"):
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

  return {
    interpretCommand,
  };
}
