import { JiraClient, OperationResult } from '../types';
import { jiraRequest } from '../client';
import { logger } from '../../../utils/logger';

export function configureCommentOperations(client: JiraClient) {
  async function addComment({ 
    issueKey, 
    comment 
  }: { 
    issueKey: string; 
    comment: string 
  }): Promise<OperationResult> {
    logger.info(`Adding comment to issue ${issueKey}`);
    
    const commentData = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: comment
              }
            ]
          }
        ]
      }
    };
    
    await jiraRequest(
      client,
      `/rest/api/3/issue/${issueKey}/comment`,
      'POST',
      commentData
    );
    
    return { 
      success: true, 
      message: `Successfully added comment to issue ${issueKey}`
    };
  }
  
  return {
    addComment
  };
} 