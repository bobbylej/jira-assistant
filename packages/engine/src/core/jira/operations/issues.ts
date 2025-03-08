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
  
  async function linkIssues({ 
    sourceIssueKey, 
    targetIssueKey, 
    linkType = 'relates to' 
  }: { 
    sourceIssueKey: string; 
    targetIssueKey: string; 
    linkType?: string 
  }): Promise<OperationResult> {
    logger.info(`Linking issue ${sourceIssueKey} to ${targetIssueKey} with link type "${linkType}"`);
    
    try {
      // First, check if the target issue is an Epic
      const targetIssue = await jiraRequest<JiraIssue>(
        client,
        `/rest/api/3/issue/${targetIssueKey}`,
        'GET'
      );
      
      // Check if we're trying to link to an Epic
      if (targetIssue.fields.issuetype.name === 'Epic') {
        logger.info(`Target issue ${targetIssueKey} is an Epic`);
        
        // For Jira Cloud, we need to find the Epic Link field
        // First, get the field metadata to find the Epic Link field
        const fieldsMetadata = await jiraRequest<any>(
          client,
          `/rest/api/3/field`,
          'GET'
        );
        
        // Find the Epic Link field
        const epicLinkField = fieldsMetadata.find((field: any) => 
          field.name === 'Epic Link' || 
          field.name === 'Parent Link' || 
          field.name.includes('Epic')
        );
        
        if (epicLinkField) {
          logger.info(`Found Epic Link field: ${epicLinkField.id}`);
          
          try {
            // Try to update the Epic Link field
            await jiraRequest(
              client,
              `/rest/api/3/issue/${sourceIssueKey}`,
              'PUT',
              {
                fields: {
                  [epicLinkField.id]: targetIssueKey
                }
              }
            );
            
            return { 
              success: true, 
              message: `Successfully linked issue ${sourceIssueKey} to Epic ${targetIssueKey}` 
            };
          } catch (epicLinkError) {
            logger.warn(`Failed to set Epic Link field: ${epicLinkError}`);
            // Continue to try other methods
          }
        }
        
        // If we couldn't use the Epic Link field, try using the standard issue link
        logger.info(`Falling back to standard issue link for Epic relationship`);
      }
      
      // Use standard issue links as a fallback
      // Map common link type names to Jira's internal link type names
      const linkTypeMap: Record<string, string> = {
        'is part of': 'Relates',
        'has part': 'Relates',
        'parent': 'Relates',
        'relates to': 'Relates',
        'is related to': 'Relates',
        'blocks': 'Blocks',
        'is blocked by': 'Blocked'
      };
      
      const mappedLinkType = linkTypeMap[linkType.toLowerCase()] || linkType;
      
      logger.info(`Creating standard issue link with type "${mappedLinkType}"`);
      
      // Create a standard issue link
      const response = await fetch(`${client.baseUrl}/rest/api/3/issueLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${client.auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: {
            name: mappedLinkType
          },
          inwardIssue: {
            key: targetIssueKey
          },
          outwardIssue: {
            key: sourceIssueKey
          }
        })
      });
      
      if (!response.ok) {
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } catch (e) {
          // If we can't parse the response as JSON, just use the status text
        }
        
        throw new Error(`Jira API error: ${errorMessage}`);
      }
      
      // For 204 No Content responses
      if (response.status === 204) {
        return { 
          success: true, 
          message: `Successfully linked issue ${sourceIssueKey} to ${targetIssueKey}` 
        };
      }
      
      // For responses with content
      const responseData = await response.json();
      logger.debug(`Response: ${JSON.stringify(responseData)}`);
      
      return { 
        success: true, 
        message: `Successfully linked issue ${sourceIssueKey} to ${targetIssueKey}` 
      };
    } catch (error) {
      logger.error(`Failed to link issues: ${error}`);
      
      // Try one more approach - add a comment mentioning the relationship
      try {
        logger.info(`Falling back to adding a comment about the relationship`);
        
        await jiraRequest(
          client,
          `/rest/api/3/issue/${sourceIssueKey}/comment`,
          'POST',
          {
            body: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: `This issue is related to ${targetIssueKey}. Note: Direct linking failed, this is a reference comment.`
                    }
                  ]
                }
              ]
            }
          }
        );
        
        return { 
          success: true, 
          message: `Could not create a direct link, but added a comment referencing ${targetIssueKey}` 
        };
      } catch (commentError) {
        logger.error(`Failed to add reference comment: ${commentError}`);
        throw error; // Throw the original error
      }
    }
  }
  
  return {
    getIssue,
    searchIssues,
    createIssue,
    updateIssueType,
    updateIssuePriority,
    deleteIssue,
    linkIssues
  };
} 