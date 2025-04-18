import { logger } from "../../../utils/logger";
import { JiraActionParams, JiraService } from "../../jira";
import {
  JiraActionParamsType,
  JiraContext,
  JiraParamsWithMetadata,
  MoveToEpicParams,
} from "../types";
import { ADFFieldService } from "./adfFieldService";
import { MetadataService } from "./metadataService";

export function configureActionExecutor(
  jiraService: JiraService,
  adfFieldService: ADFFieldService,
  metadataService: MetadataService
) {
  async function enhanceParams<T extends "createIssue" | "updateIssue">(
    actionParams: JiraActionParams<T>[0],
    context: JiraContext
  ): Promise<JiraActionParams<T>[0]> {
    const newActionParams: JiraActionParams<T>[0] = {
      ...actionParams,
    };
    logger.info("New action params:", JSON.stringify(newActionParams));
    logger.info("Context:", JSON.stringify(context));
    const metadataParams = await metadataService.getMetadataParams<T>(
      newActionParams,
      context
    );
    logger.info("Metadata params:", JSON.stringify(metadataParams));
    if (metadataParams) {
      const enhancedParams = await adfFieldService.enhanceADFContent<T>({
        issueType: newActionParams.issueType || "Task",
        params: metadataParams as JiraParamsWithMetadata<
          keyof JiraActionParams<T>[0]
        >,
        context,
      });
      Object.entries(enhancedParams).forEach(([key, value]) => {
        newActionParams[key as keyof JiraActionParams<T>[0]] = value.value as JiraActionParams<T>[0][keyof JiraActionParams<T>[0]];
      });
    }
    return newActionParams;
  }

  async function executeAction(
    action: JiraActionParamsType,
    context: JiraContext
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
            const enhacedParams = await enhanceParams<"createIssue">(
              action.parameters,
              context
            );
            action.parameters = enhacedParams;
            logger.info("Enhanced params:", JSON.stringify(action.parameters));
          } catch (enhaceParamsError) {
            logger.error("Failed to enhance params:", enhaceParamsError);
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

        case "moveToEpic":
          return moveToEpic(action.parameters);

        case "updateIssue":
          if (action.parameters.description) {
            try {
              const { data: issue } = await jiraService.getIssue({
                issueKey: action.parameters.issueKey,
              });
              try {
                const enhacedParams = await enhanceParams<"updateIssue">(
                  action.parameters,
                  context
                );
                action.parameters = enhacedParams;
              } catch (enhaceParamsError) {
                logger.error("Failed to enhance params:", enhaceParamsError);
                // Continue with original description if enhancement fails
              }
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
    moveToEpic,
  };
}
