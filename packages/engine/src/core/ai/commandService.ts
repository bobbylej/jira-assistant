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
import { configureADFFieldService } from "./services/adfFieldService";
import { AIProvider } from "../../adapters/ai/types";

export function configureCommandService(
  aiClient: AIProvider,
  jiraService: JiraService
) {
  // Configure the individual services
  const metadataService = configureMetadataService(jiraService);
  const adfService = configureADFFieldService(aiClient);
  const actionExecutor = configureActionExecutor(jiraService, adfService, metadataService);
  const commandInterpreter = configureCommandInterpreter(
    aiClient,
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
    context: JiraContext
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
