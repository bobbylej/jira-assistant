import { JiraConfig } from '../../config/types';
import { createJiraClient } from './client';
import { configureIssueOperations } from './operations/issues';
import { configureCommentOperations } from './operations/comments';
import { configureTransitionOperations } from './operations/transitions';
import { configureUserOperations } from './operations/users';
import { configureProjectOperations } from './operations/projects';
import { configureMetadataOperations } from './operations/metadata';

export function configureJiraService(config: JiraConfig) {
  // Create the base Jira client
  const client = createJiraClient(config);
  
  // Configure all operation groups
  const issueOperations = configureIssueOperations(client);
  const commentOperations = configureCommentOperations(client);
  const transitionOperations = configureTransitionOperations(client);
  const userOperations = configureUserOperations(client);
  const projectOperations = configureProjectOperations(client);
  const metadataOperations = configureMetadataOperations(client);
  
  // Return a combined API
  return {
    // Issue operations
    getIssue: issueOperations.getIssue,
    searchIssues: issueOperations.searchIssues,
    createIssue: issueOperations.createIssue,
    updateIssueType: issueOperations.updateIssueType,
    updateIssuePriority: issueOperations.updateIssuePriority,
    deleteIssue: issueOperations.deleteIssue,
    linkIssues: issueOperations.linkIssues,
    updateIssue: issueOperations.updateIssue,
    
    // Comment operations
    addComment: commentOperations.addComment,
    
    // Transition operations
    getIssueTransitions: transitionOperations.getIssueTransitions,
    transitionIssue: transitionOperations.transitionIssue,
    
    // User operations
    getProjectUsers: userOperations.getProjectUsers,
    assignIssue: userOperations.assignIssue,
    
    // Project operations
    getProjectInfo: projectOperations.getProjectInfo,

    // Metadata operations
    getCreateMetadataIssueTypes: metadataOperations.getCreateMetadataIssueTypes,
    getCreateFieldMetadata: metadataOperations.getCreateFieldMetadata,

    // Training operations
    searchTrainingIssuesWithADF: issueOperations.searchTrainingIssuesWithADF,
  };
}

export type JiraService = ReturnType<typeof configureJiraService>;
export type JiraActionParams<T extends keyof JiraService> = Parameters<JiraService[T]>;
// Re-export types
export * from './types'; 