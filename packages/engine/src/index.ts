import { createAIClient } from "./adapters/ai/client";
import { configureJiraService } from "./core/jira";
import { configureIntentService, configureCommandService } from "./core/ai";
import { configureTranscriptionService } from "./core/ai/transcriptionService";
import { configureMessageStore } from "./core/chat/messageStore";
import { configureChatManager } from "./core/chat/chatManager";
import { configureLogger, Logger } from "./utils/logger";
import { createJiraClient, jiraRequest } from "./core/jira/client";
import { JiraClient } from "./core/jira/types";
import { AIProviderType } from "./adapters/ai/types";

export interface EngineConfig {
  aiApiKey: string;
  aiProvider: AIProviderType;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  logsDir: string;
  dataDir: string;
}

async function validateJiraCredentials(
  jiraClient: JiraClient,
  logger: Logger
): Promise<boolean> {
  try {
    logger.info("Validating Jira credentials...");

    // Try to get the current user information
    const response = await jiraRequest<any>(
      jiraClient,
      "/rest/api/3/myself",
      "GET"
    );

    if (response && response.accountId) {
      logger.info(
        `Jira authentication successful. Connected as: ${response.displayName} (${response.emailAddress})`
      );
      return true;
    } else {
      logger.error("Jira authentication failed: Invalid response");
      return false;
    }
  } catch (error) {
    logger.error("Jira authentication failed:", error);
    return false;
  }
}

export function configureEngine(config: EngineConfig) {
  // Configure logger
  const logger = configureLogger(config.logsDir);

  // Initialize OpenAI client
  const openai = createAIClient(config.aiProvider, {
    apiKey: config.aiApiKey,
  });

  // Initialize Jira service
  const jiraService = configureJiraService({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  // Initialize AI services
  const intentService = configureIntentService(openai);
  const commandService = configureCommandService(openai, jiraService);
  const transcriptionService = configureTranscriptionService(openai, {
    tempDir: config.dataDir,
  });

  // Initialize chat services
  const messageStore = configureMessageStore({ dataDir: config.dataDir });
  const chatManager = configureChatManager(messageStore);

  // Create Jira client
  const jiraClient = createJiraClient({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken,
  });

  // Validate Jira credentials
  validateJiraCredentials(jiraClient, logger)
    .then((isValid) => {
      if (!isValid) {
        logger.error(
          "WARNING: Jira credentials validation failed. The application may not work correctly."
        );
      }
    })
    .catch((error) => {
      logger.error("Error validating Jira credentials:", error);
    });

  // Return the public API
  return {
    // Chat management
    getActiveChat: chatManager.getActiveChat,
    setActiveChat: chatManager.setActiveChat,
    createNewChat: chatManager.createNewChat,
    clearChat: chatManager.clearChat,
    getChats: chatManager.getChats,
    addMessage: chatManager.addMessage,
    getMessages: chatManager.getMessages,

    // AI capabilities
    determineIntent: intentService.determineIntent,
    interpretCommand: commandService.interpretCommand,
    executeAction: commandService.executeAction,
    transcribeAudio: transcriptionService.transcribeAudio,

    // Jira operations
    getIssue: jiraService.getIssue,
    searchIssues: jiraService.searchIssues,
    getProjectInfo: jiraService.getProjectInfo,
    createIssue: jiraService.createIssue,
    updateIssueType: jiraService.updateIssueType,
    deleteIssue: jiraService.deleteIssue,
    addComment: jiraService.addComment,
    assignIssue: jiraService.assignIssue,
    getIssueTransitions: jiraService.getIssueTransitions,
    transitionIssue: jiraService.transitionIssue,
    getProjectUsers: jiraService.getProjectUsers,
    updateIssuePriority: jiraService.updateIssuePriority,
    linkIssues: jiraService.linkIssues,
    updateIssue: jiraService.updateIssue,

    // Utilities
    logToFile: logger.logToFile,
  };
}

// Remove these direct exports since they're no longer available
// export {
//   transcribeAudio,
//   interpretCommand,
//   determineIntent,
//   executeAction,
//   getIssue,
//   searchIssues,
//   getProjectInfo,
//   createIssue,
//   updateIssueType,
//   createNewChat,
//   getActiveChat,
//   addMessage,
//   getMessages,
//   getChats,
//   clearChat,
//   setActiveChat,
//   logToFile,
// };
