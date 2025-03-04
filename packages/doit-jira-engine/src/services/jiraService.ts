import axios from 'axios';
import fs from 'fs';
import path from 'path';
import util from 'util';

// Types
interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

// Export the JiraResponse interface
export interface JiraResponse {
  success: boolean;
  message: string;
  data?: any;
}

export function configureJiraService(config: JiraConfig) {
  console.log('Jira API URL:', `${config.baseUrl}/rest/api/2/issue`);

  // Create Axios instance for Jira API
  const jiraApi = axios.create({
    baseURL: config.baseUrl,
    auth: {
      username: config.email,
      password: config.apiToken
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Create a logging function
  function logToFile(type: string, data: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      data
    };
    
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Append to log file
    fs.appendFileSync(
      path.join(logsDir, 'jira.log'), 
      JSON.stringify(logEntry, null, 2) + ',\n', 
      { flag: 'a+' }
    );
    
    // Also log to console for immediate feedback
    console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
  }

  /**
   * Executes a Jira action based on the interpreted command
   * @param {Object} action - The structured action to perform
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function executeAction(action: any): Promise<JiraResponse> {
    try {
      const { actionType, parameters } = action;
      logToFile('EXECUTE_ACTION', { actionType, parameters });
      
      // Special case for when we're returning a pre-computed result
      if (parameters.result && parameters.result.success !== undefined) {
        logToFile('RETURNING_PRECOMPUTED_RESULT', { result: parameters.result });
        return parameters.result;
      }
      
      let result;
      switch (actionType) {
        case 'createIssue':
          result = await createIssue(parameters);
          break;
        case 'getIssue':
          result = await getIssue(parameters);
          break;
        case 'updateIssue':
          result = await updateIssue(parameters);
          break;
        case 'searchIssues':
          result = await searchIssues(parameters);
          break;
        case 'assignIssue':
          result = await assignIssue(parameters);
          break;
        case 'addComment':
          result = await addComment(parameters);
          break;
        case 'transitionIssue':
          result = await transitionIssue(parameters);
          break;
        default:
          throw new Error(`Unsupported action type: ${actionType}`);
      }
      
      logToFile('ACTION_RESULT', { result });
      return result;
    } catch (error: any) {
      logToFile('ACTION_ERROR', { 
        error: error.message,
        stack: error.stack
      });
      console.error('Error executing Jira action:', error);
      throw new Error(`Failed to execute Jira action: ${error.message}`);
    }
  }

  /**
   * Gets details of a specific Jira issue
   * @param {Object} parameters - Issue retrieval parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function getIssue(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey } = parameters;
      
      const response = await jiraApi.get(`/rest/api/2/issue/${issueKey}`);
      
      return {
        success: true,
        message: `Retrieved issue ${issueKey}`,
        data: {
          key: response.data.key,
          summary: response.data.fields.summary,
          description: response.data.fields.description,
          status: response.data.fields.status.name,
          issueType: response.data.fields.issuetype.name,
          priority: response.data.fields.priority?.name,
          assignee: response.data.fields.assignee?.displayName,
          reporter: response.data.fields.reporter?.displayName,
          created: response.data.fields.created,
          updated: response.data.fields.updated
        }
      };
    } catch (error: any) {
      console.error('Error getting issue:', error);
      return {
        success: false,
        message: `Failed to get issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Searches for Jira issues using JQL
   * @param {Object} parameters - Search parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function searchIssues(parameters: any): Promise<JiraResponse> {
    try {
      const { jql, maxResults = 10 } = parameters;
      
      const response = await jiraApi.post('/rest/api/2/search', {
        jql,
        maxResults,
        fields: ['key', 'summary', 'status', 'issuetype', 'priority', 'assignee']
      });
      
      return {
        success: true,
        message: `Found ${response.data.issues.length} issues`,
        data: {
          total: response.data.total,
          issues: response.data.issues.map((issue: any) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            issueType: issue.fields.issuetype.name,
            priority: issue.fields.priority?.name,
            assignee: issue.fields.assignee?.displayName
          }))
        }
      };
    } catch (error: any) {
      console.error('Error searching issues:', error);
      return {
        success: false,
        message: `Failed to search issues: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Updates an existing Jira issue
   * @param {Object} parameters - Issue update parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function updateIssue(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey, summary, description, issueType, priority, assignee } = parameters;
      
      const updateData: any = {
        fields: {}
      };
      
      // Add fields that are provided
      if (summary) updateData.fields.summary = summary;
      if (description) updateData.fields.description = description;
      if (issueType) updateData.fields.issuetype = { name: issueType };
      if (priority) updateData.fields.priority = { name: priority };
      if (assignee) updateData.fields.assignee = { name: assignee };
      
      await jiraApi.put(`/rest/api/2/issue/${issueKey}`, updateData);
      
      return {
        success: true,
        message: `Issue ${issueKey} updated successfully`
      };
    } catch (error: any) {
      console.error('Error updating issue:', error);
      return {
        success: false,
        message: `Failed to update issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Assigns a Jira issue to a user
   * @param {Object} parameters - Assignment parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function assignIssue(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey, assignee } = parameters;
      
      await jiraApi.put(`/rest/api/2/issue/${issueKey}/assignee`, {
        name: assignee
      });
      
      return {
        success: true,
        message: `Issue ${issueKey} assigned to ${assignee}`
      };
    } catch (error: any) {
      console.error('Error assigning issue:', error);
      return {
        success: false,
        message: `Failed to assign issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Adds a comment to a Jira issue
   * @param {Object} parameters - Comment parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function addComment(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey, comment } = parameters;
      
      const response = await jiraApi.post(`/rest/api/2/issue/${issueKey}/comment`, {
        body: comment
      });
      
      return {
        success: true,
        message: `Comment added to issue ${issueKey}`,
        data: {
          id: response.data.id,
          author: response.data.author.displayName,
          created: response.data.created
        }
      };
    } catch (error: any) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        message: `Failed to add comment: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Transitions a Jira issue to a new status
   * @param {Object} parameters - Transition parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function transitionIssue(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey, transitionName } = parameters;
      
      // Get available transitions
      const transitionsResponse = await jiraApi.get(`/rest/api/2/issue/${issueKey}/transitions`);
      const transitions = transitionsResponse.data.transitions;
      
      // Find the requested transition
      const transition = transitions.find((t: any) => 
        t.name.toLowerCase() === transitionName.toLowerCase()
      );
      
      if (!transition) {
        return {
          success: false,
          message: `Transition "${transitionName}" not found for issue ${issueKey}`
        };
      }
      
      // Perform the transition
      await jiraApi.post(`/rest/api/2/issue/${issueKey}/transitions`, {
        transition: { id: transition.id }
      });
      
      return {
        success: true,
        message: `Issue ${issueKey} transitioned to "${transitionName}"`
      };
    } catch (error: any) {
      console.error('Error transitioning issue:', error);
      return {
        success: false,
        message: `Failed to transition issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Gets information about a Jira project
   * @param {Object} parameters - Project retrieval parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function getProjectInfo(parameters: any): Promise<JiraResponse> {
    try {
      const { projectKey } = parameters;
      
      const response = await jiraApi.get(`/rest/api/2/project/${projectKey}`);
      
      return {
        success: true,
        message: `Retrieved project ${projectKey}`,
        data: {
          key: response.data.key,
          name: response.data.name,
          description: response.data.description,
          lead: response.data.lead?.displayName,
          issueTypes: response.data.issueTypes?.map((type: any) => ({
            id: type.id,
            name: type.name,
            description: type.description
          }))
        }
      };
    } catch (error: any) {
      console.error('Error getting project info:', error);
      return {
        success: false,
        message: `Failed to get project info: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Creates a new Jira issue
   * @param {Object} parameters - Issue creation parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function createIssue(parameters: any): Promise<JiraResponse> {
    try {
      const { projectKey, summary, description, issueType, parentKey } = parameters;
      
      // Build the issue creation payload
      const payload: any = {
        fields: {
          project: {
            key: projectKey
          },
          summary: summary,
          description: description || "",
          issuetype: {
            name: issueType
          }
        }
      };
      
      // Add parent if provided (for sub-tasks or stories under epics)
      if (parentKey) {
        payload.fields.parent = {
          key: parentKey
        };
      }
      
      const response = await jiraApi.post('/rest/api/2/issue', payload);
      
      return {
        success: true,
        message: `Issue created successfully: ${response.data.key}`,
        data: {
          key: response.data.key,
          self: response.data.self
        }
      };
    } catch (error: any) {
      console.error('Error creating issue:', error);
      return {
        success: false,
        message: `Failed to create issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Updates the issue type of an existing Jira issue
   * @param {Object} parameters - Issue type update parameters
   * @returns {Promise<JiraResponse>} - The result of the action
   */
  async function updateIssueType(parameters: any): Promise<JiraResponse> {
    try {
      const { issueKey, newIssueType } = parameters;
      
      // Update the issue type
      await jiraApi.put(`/rest/api/2/issue/${issueKey}`, {
        fields: {
          issuetype: {
            name: newIssueType
          }
        }
      });
      
      return {
        success: true,
        message: `Issue ${issueKey} updated to type ${newIssueType}`
      };
    } catch (error: any) {
      console.error('Error updating issue type:', error);
      return {
        success: false,
        message: `Failed to update issue type: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
      };
    }
  }

  /**
   * Deletes a Jira issue
   * @param {string} issueKey - The key of the issue to delete
   * @returns {Promise<boolean>} - True if deletion was successful
   */
  async function deleteIssue(issueKey: string): Promise<boolean> {
    try {
      console.log(`Deleting issue ${issueKey}`);
      
      const response = await jiraApi.delete(`/rest/api/3/issue/${issueKey}`);
      
      console.log(`Successfully deleted issue ${issueKey}`);
      return true;
    } catch (error: any) {
      console.error(`Error deleting issue ${issueKey}:`, error);
      throw error;
    }
  }

  return {
    getIssue,
    searchIssues,
    getProjectInfo,
    createIssue,
    updateIssueType,
    deleteIssue
  };
}
