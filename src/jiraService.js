const axios = require('axios');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Jira API configuration
const jiraConfig = {
    baseUrl: process.env.JIRA_BASE_URL.endsWith('/') 
        ? process.env.JIRA_BASE_URL.slice(0, -1) 
        : process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN
};

console.log('Jira API URL:', `${jiraConfig.baseUrl}/rest/api/2/issue`);

// Create Axios instance for Jira API
const jiraApi = axios.create({
    baseURL: jiraConfig.baseUrl,
    auth: {
        username: jiraConfig.email,
        password: jiraConfig.apiToken
    },
    headers: {
        'Content-Type': 'application/json'
    }
});

// Create a logging function
function logToFile(type, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        data
    };
    
    // Append to log file
    fs.appendFileSync(
        path.join(__dirname, '../logs/jira.log'), 
        JSON.stringify(logEntry, null, 2) + ',\n', 
        { flag: 'a+' }
    );
    
    // Also log to console for immediate feedback
    console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
}

/**
 * Executes a Jira action based on the interpreted command
 * @param {Object} action - The structured action to perform
 * @returns {Promise<Object>} - The result of the action
 */
async function executeAction(action) {
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
    } catch (error) {
        logToFile('ACTION_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Error executing Jira action:', error);
        throw new Error(`Failed to execute Jira action: ${error.message}`);
    }
}

/**
 * Creates a new Jira issue
 * @param {Object} parameters - Issue creation parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function createIssue(parameters) {
    try {
        const { projectKey, summary, description, issueType, parentKey } = parameters;
        
        // Build the issue creation payload
        const payload = {
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
    } catch (error) {
        console.error('Error creating issue:', error);
        return {
            success: false,
            message: `Failed to create issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Gets details of a specific Jira issue
 * @param {Object} parameters - Issue retrieval parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function getIssue(parameters) {
    try {
        const { issueKey } = parameters;
        
        const response = await jiraApi.get(`/rest/api/2/issue/${issueKey}`);
        
        return {
            success: true,
            message: `Retrieved issue ${issueKey}`,
            data: {
                key: response.data.key,
                summary: response.data.fields.summary,
                status: response.data.fields.status.name,
                assignee: response.data.fields.assignee?.displayName || 'Unassigned',
                priority: response.data.fields.priority?.name,
                description: response.data.fields.description
            }
        };
    } catch (error) {
        console.error('Error getting issue:', error);
        return {
            success: false,
            message: `Failed to get issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Updates an existing Jira issue
 * @param {Object} parameters - Issue update parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function updateIssue(parameters) {
    try {
        const { issueKey, summary, description, priority } = parameters;
        
        const updateData = {
            fields: {}
        };
        
        // Add fields to update if provided
        if (summary) {
            updateData.fields.summary = summary;
        }
        
        if (description) {
            updateData.fields.description = description;
        }
        
        if (priority) {
            updateData.fields.priority = { name: priority };
        }
        
        await jiraApi.put(`/rest/api/2/issue/${issueKey}`, updateData);
        
        return {
            success: true,
            message: `Issue ${issueKey} updated successfully`
        };
    } catch (error) {
        console.error('Error updating issue:', error);
        return {
            success: false,
            message: `Failed to update issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Searches for Jira issues using JQL
 * @param {Object} parameters - Search parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function searchIssues(parameters) {
    try {
        const { jql, maxResults = 10 } = parameters;
        
        const response = await jiraApi.post('/rest/api/2/search', {
            jql: jql,
            maxResults: maxResults,
            fields: ['key', 'summary', 'status', 'assignee', 'priority']
        });
        
        const issues = response.data.issues.map(issue => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            priority: issue.fields.priority?.name
        }));
        
        return {
            success: true,
            message: `Found ${issues.length} issues`,
            data: issues
        };
    } catch (error) {
        console.error('Error searching issues:', error);
        return {
            success: false,
            message: `Failed to search issues: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Assigns a Jira issue to a user
 * @param {Object} parameters - Assignment parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function assignIssue(parameters) {
    try {
        const { issueKey, assignee } = parameters;
        
        await jiraApi.put(`/rest/api/2/issue/${issueKey}/assignee`, {
            name: assignee
        });
        
        return {
            success: true,
            message: `Issue ${issueKey} assigned to ${assignee}`
        };
    } catch (error) {
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
 * @returns {Promise<Object>} - The result of the action
 */
async function addComment(parameters) {
    try {
        const { issueKey, comment } = parameters;
        
        await jiraApi.post(`/rest/api/2/issue/${issueKey}/comment`, {
            body: comment
        });
        
        return {
            success: true,
            message: `Comment added to issue ${issueKey}`
        };
    } catch (error) {
        console.error('Error adding comment:', error);
        return {
            success: false,
            message: `Failed to add comment: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Changes the status of a Jira issue
 * @param {Object} parameters - Transition parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function transitionIssue(parameters) {
    try {
        const { issueKey, transitionName } = parameters;
        
        // First, get available transitions
        const transitionsResponse = await jiraApi.get(`/rest/api/2/issue/${issueKey}/transitions`);
        const transitions = transitionsResponse.data.transitions;
        
        // Find the transition ID by name
        const transition = transitions.find(t => 
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
    } catch (error) {
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
 * @returns {Promise<Object>} - The result of the action
 */
async function getProjectInfo(parameters) {
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
                issueTypes: response.data.issueTypes?.map(type => ({
                    id: type.id,
                    name: type.name,
                    description: type.description
                }))
            }
        };
    } catch (error) {
        console.error('Error getting project info:', error);
        return {
            success: false,
            message: `Failed to get project info: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

/**
 * Updates the issue type of an existing Jira issue
 * @param {Object} parameters - Issue type update parameters
 * @returns {Promise<Object>} - The result of the action
 */
async function updateIssueType(parameters) {
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
    } catch (error) {
        console.error('Error updating issue type:', error);
        return {
            success: false,
            message: `Failed to update issue type: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        };
    }
}

module.exports = {
    executeAction,
    getIssue,
    searchIssues,
    getProjectInfo,
    createIssue,
    updateIssueType
}; 