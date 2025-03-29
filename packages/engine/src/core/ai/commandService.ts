import { OpenAI } from "openai";
import { JiraService } from "../jira";
import {
  ChatMessage,
  JiraActionParamsType,
  JiraContext,
} from "./types";
import { configureCommandInterpreter } from "./services/commandInterpreter";
import { configureActionExecutor } from "./services/actionExecutor";
import { configureMetadataService } from "./services/metadataService";
import { configureDescriptionService } from "./services/descriptionService";

export function configureCommandService(
  openai: OpenAI,
  jiraService: JiraService
) {
  // Configure the individual services
  const metadataService = configureMetadataService(jiraService);
  const descriptionService = configureDescriptionService(openai);
  const actionExecutor = configureActionExecutor(jiraService, descriptionService);
  const commandInterpreter = configureCommandInterpreter(
    openai,
    metadataService,
  );

  async function interpretCommand(
    text: string,
    context?: JiraContext,
    chatHistory?: ChatMessage[]
  ) {
    return commandInterpreter.interpretCommand(text, context, chatHistory);
  }

  async function executeAction(
    action: JiraActionParamsType,
    context?: JiraContext
  ) {
    return actionExecutor.executeAction(action, context);
  }

  async function fetchJiraMetadata(projectIdOrKey?: string) {
    return metadataService.fetchJiraMetadata(projectIdOrKey);
  }

  return {
    interpretCommand,
    executeAction,
    fetchJiraMetadata,
  };
}
