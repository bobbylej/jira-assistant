import { JiraClient, JiraTransitionsResponse, OperationResult } from '../types';
import { jiraRequest } from '../client';
import { logger } from '../../../utils/logger';

export function configureTransitionOperations(client: JiraClient) {
  async function getIssueTransitions({ 
    issueKey 
  }: { 
    issueKey: string 
  }): Promise<JiraTransitionsResponse> {
    logger.info(`Getting transitions for issue ${issueKey}`);
    
    return jiraRequest<JiraTransitionsResponse>(
      client,
      `/rest/api/3/issue/${issueKey}/transitions`,
      'GET'
    );
  }
  
  async function transitionIssue({ 
    issueKey, 
    transitionId 
  }: { 
    issueKey: string; 
    transitionId: string 
  }): Promise<OperationResult> {
    logger.info(`Transitioning issue ${issueKey} with transition ${transitionId}`);
    
    await jiraRequest(
      client,
      `/rest/api/3/issue/${issueKey}/transitions`,
      'POST',
      {
        transition: {
          id: transitionId
        }
      }
    );
    
    return { 
      success: true, 
      message: `Successfully transitioned issue ${issueKey}` 
    };
  }
  
  return {
    getIssueTransitions,
    transitionIssue
  };
} 