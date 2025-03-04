import { JiraConfig } from '../../config/types';
import { JiraClient } from './types';
import { logger } from '../../utils/logger';

export function createJiraClient(config: JiraConfig): JiraClient {
  const baseUrl = config.baseUrl;
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  
  return {
    baseUrl,
    auth
  };
}

export async function jiraRequest<T>(
  client: JiraClient,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: any
): Promise<T> {
  try {
    const url = `${client.baseUrl}${endpoint}`;
    logger.info(`Making ${method} request to ${url}`);
    
    const headers: HeadersInit = {
      'Authorization': `Basic ${client.auth}`,
      'Accept': 'application/json'
    };
    
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }
    
    // For DELETE requests that don't return content
    if (method === 'DELETE' && response.status === 204) {
      return {} as T;
    }
    
    return await response.json() as T;
  } catch (error: unknown) {
    logger.error(`Error in Jira API request: ${endpoint}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Jira API error: ${errorMessage}`);
  }
} 