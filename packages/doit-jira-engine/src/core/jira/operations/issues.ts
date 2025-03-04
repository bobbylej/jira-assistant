import { JiraClient, JiraIssue, JiraSearchResult, OperationResult } from '../types';
import { jiraRequest } from '../client';
import { logger } from '../../../utils/logger';

export function configureIssueOperations(client: JiraClient) {
  async function getIssue({ issueKey }: { issueKey: string }): Promise<JiraIssue> {
    logger.info(`Getting issue: ${issueKey}`);
    return jiraRequest<JiraIssue>(client, `/rest/api/3/issue/${issueKey}`, 'GET');
  }
  
  async function searchIssues({ jql, maxResults = 10 }: { jql: string; maxResults?: number }): Promise<JiraSearchResult> {
    logger.info(`Searching issues with JQL: ${jql}`);
    
    return jiraRequest<JiraSearchResult>(
      client,
      '/rest/api/3/search',
      'POST',
      {
        jql,
        maxResults,
        fields: ['summary', 'status', 'issuetype', 'priority', 'assignee']
      }
    );
  }
  
  async function createIssue({ 
    projectKey, 
    summary, 
    description, 
    issueType 
  }: { 
    projectKey: string; 
    summary: string; 
    description?: string; 
    issueType: string 
  }): Promise<JiraIssue> {
    logger.info(`Creating issue in project ${projectKey}: ${summary}`);
    
    const issueData = {
      fields: {
        project: {
          key: projectKey
        },
        summary,
        description: description ? {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description
                }
              ]
            }
          ]
        } : undefined,
        issuetype: {
          name: issueType
        }
      }
    };
    
    return jiraRequest<JiraIssue>(client, '/rest/api/3/issue', 'POST', issueData);
  }
  
  async function updateIssueType({ 
    issueKey, 
    issueType 
  }: { 
    issueKey: string; 
    issueType: string 
  }): Promise<OperationResult> {
    logger.info(`Updating issue type for ${issueKey} to ${issueType}`);
    
    await jiraRequest(
      client,
      `/rest/api/3/issue/${issueKey}`,
      'PUT',
      {
        fields: {
          issuetype: {
            name: issueType
          }
        }
      }
    );
    
    return { 
      success: true, 
      message: `Successfully updated issue type for ${issueKey} to ${issueType}` 
    };
  }
  
  async function updateIssuePriority({ 
    issueKey, 
    priority 
  }: { 
    issueKey: string; 
    priority: string 
  }): Promise<OperationResult> {
    logger.info(`Updating priority for issue ${issueKey} to ${priority}`);
    
    await jiraRequest(
      client,
      `/rest/api/3/issue/${issueKey}`,
      'PUT',
      {
        fields: {
          priority: {
            name: priority
          }
        }
      }
    );
    
    return { 
      success: true, 
      message: `Successfully updated priority for issue ${issueKey} to ${priority}` 
    };
  }
  
  async function deleteIssue({ issueKey }: { issueKey: string }): Promise<OperationResult> {
    try {
      logger.info(`Deleting issue: ${issueKey}`);
      
      await jiraRequest(client, `/rest/api/3/issue/${issueKey}`, 'DELETE');
      
      return { 
        success: true, 
        message: `Successfully deleted issue ${issueKey}` 
      };
    } catch (error: unknown) {
      logger.error('Error deleting issue:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { 
        success: false, 
        message: `Failed to delete issue: ${errorMessage}` 
      };
    }
  }
  
  return {
    getIssue,
    searchIssues,
    createIssue,
    updateIssueType,
    updateIssuePriority,
    deleteIssue
  };
} 