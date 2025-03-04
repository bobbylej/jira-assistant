import { JiraClient } from '../types';
import { jiraRequest } from '../client';
import { logger } from '../../../utils/logger';

export function configureProjectOperations(client: JiraClient) {
  async function getProjectInfo({ 
    projectKey 
  }: { 
    projectKey: string 
  }): Promise<any> {
    logger.info(`Getting project info: ${projectKey}`);
    
    return jiraRequest<any>(
      client,
      `/rest/api/3/project/${projectKey}`,
      'GET'
    );
  }
  
  return {
    getProjectInfo
  };
} 