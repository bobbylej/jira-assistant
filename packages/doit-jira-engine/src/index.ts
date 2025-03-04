import { createOpenAIClient } from './adapters/openai/client';
import { configureJiraService } from './core/jira';
import { configureIntentService, configureCommandService } from './core/ai';
import { configureTranscriptionService } from './core/ai/transcriptionService';
import { configureMessageStore } from './core/chat/messageStore';
import { configureChatManager } from './core/chat/chatManager';
import { configureLogger } from './utils/logger';

export interface EngineConfig {
  openaiApiKey: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  logsDir: string;
  dataDir: string;
}

export function configureEngine(config: EngineConfig) {
  // Configure logger
  const logger = configureLogger(config.logsDir);
  
  // Initialize OpenAI client
  const openai = createOpenAIClient({ apiKey: config.openaiApiKey });
  
  // Initialize Jira service
  const jiraService = configureJiraService({
    baseUrl: config.jiraBaseUrl,
    email: config.jiraEmail,
    apiToken: config.jiraApiToken
  });
  
  // Initialize AI services
  const intentService = configureIntentService(openai);
  const commandService = configureCommandService(openai, jiraService);
  const transcriptionService = configureTranscriptionService(openai, { tempDir: config.dataDir });
  
  // Initialize chat services
  const messageStore = configureMessageStore({ dataDir: config.dataDir });
  const chatManager = configureChatManager(messageStore);
  
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
    
    // Utilities
    logToFile: logger.logToFile
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
