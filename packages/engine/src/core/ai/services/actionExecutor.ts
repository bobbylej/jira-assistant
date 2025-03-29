import { logger } from "../../../utils/logger";
import { JiraService } from "../../jira";
import {
  CreateAndLinkSubtasksParams,
  CreateEpicAndLinkParams,
  JiraActionParamsType,
  JiraContext,
  MoveToEpicParams,
} from "../types";
import { DescriptionService } from "./descriptionService";

export function configureActionExecutor(
  jiraService: JiraService,
  descriptionService: DescriptionService
) {
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
            action.parameters.description = await descriptionService.enhanceDescription(
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
              action.parameters.description = await descriptionService.enhanceDescription(
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
        params.epicDescription = await descriptionService.enhanceDescription(
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
        `Creating ${params.subtasks.length} subtasks for parent issue ${params.parent}`
      );

      // Get parent issue details to use the same project
      const { data: parentIssue } = await jiraService.getIssue({
        issueKey: params.parent,
      });

      if (!parentIssue) {
        return {
          success: false,
          message: `Failed to get parent issue ${params.parent}`,
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
              subtask.description = await descriptionService.enhanceDescription(
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
                subtask.description || `Subtask for ${params.parent}`,
              issueType: "Sub-task",
              parent: params.parent,
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
        } subtasks for ${params.parent}: ${createdSubtasks.join(", ")}. `;
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

  return {
    executeAction,
    createEpicAndLink,
    createAndLinkSubtasks,
    moveToEpic,
  };
} 