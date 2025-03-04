import { JiraClient, JiraUser, OperationResult } from '../types';
import { jiraRequest } from '../client';
import { logger } from '../../../utils/logger';

export function configureUserOperations(client: JiraClient) {
  async function getProjectUsers({ 
    projectKey 
  }: { 
    projectKey: string 
  }): Promise<JiraUser[]> {
    logger.info(`Getting users for project ${projectKey}`);
    
    return jiraRequest<JiraUser[]>(
      client,
      `/rest/api/3/user/assignable/search?project=${projectKey}`,
      'GET'
    );
  }
  
  async function assignIssue({ 
    issueKey, 
    accountId 
  }: { 
    issueKey: string; 
    accountId: string 
  }): Promise<OperationResult> {
    logger.info(`Assigning issue ${issueKey} to user ${accountId}`);
    
    await jiraRequest(
      client,
      `/rest/api/3/issue/${issueKey}/assignee`,
      'PUT',
      { accountId }
    );
    
    return { 
      success: true, 
      message: `Successfully assigned issue ${issueKey}` 
    };
  }
  
  return {
    getProjectUsers,
    assignIssue
  };
} 