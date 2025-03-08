import { JiraConfig } from '../../config/types';
import { JiraClient } from './types';
import { logger } from '../../utils/logger';

export function createJiraClient(config: JiraConfig): JiraClient {
  const baseUrl = config.baseUrl;
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  
  // Log configuration (without sensitive data)
  logger.info(`Creating Jira client for ${baseUrl}`);
  
  return {
    baseUrl,
    auth,
    email: config.email
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
    
    // Create headers with proper authentication
    const headers: HeadersInit = {
      'Authorization': `Basic ${client.auth}`,
      'Accept': 'application/json'
    };
    
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Log request details (without auth header)
    logger.debug(`Request headers: ${JSON.stringify({...headers, Authorization: '[REDACTED]'})}`);
    if (body) {
      logger.debug(`Request body: ${JSON.stringify(body)}`);
    }
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // Handle error responses
    if (!response.ok) {
      // Try to get more detailed error information
      let errorDetails = '';
      try {
        const errorJson = await response.json();
        errorDetails = JSON.stringify(errorJson);
        logger.error(`Jira API error details: ${errorDetails}`);
      } catch (e) {
        // If we can't parse the response as JSON, just use the status text
        errorDetails = response.statusText;
      }
      
      throw new Error(`Jira API error: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }
    
    // For DELETE requests that don't return content
    if (method === 'DELETE' && response.status === 204) {
      return {} as T;
    }
    
    // Parse and return the response
    const responseData = await response.json() as T;
    logger.debug(`Response: ${JSON.stringify(responseData)}`);
    return responseData;
  } catch (error: unknown) {
    logger.error(`Error in Jira API request: ${endpoint}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Jira API error: ${errorMessage}`);
  }
} 