#!/usr/bin/env node

/**
 * Script to fetch comprehensive Jira ticket details
 * Usage: node get-jira-ticket-details.js <ticket_id>
 * Example: node get-jira-ticket-details.js SPREE-123
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const CONFIG = {
  timeout: 30000, // 30 seconds
  userAgent: 'Jira-Ticket-Details-Script/1.0',
};

/**
 * Display usage information
 */
function usage() {
  console.log('Usage: node get-jira-ticket-details.js <ticket_id>');
  console.log('Example: node get-jira-ticket-details.js SPREE-123');
  console.log('');
  console.log('Required environment variables:');
  console.log('  JIRA_BASE_URL - Jira instance URL (e.g., https://yourcompany.atlassian.net)');
  console.log('  JIRA_USER_EMAIL - Your Jira email');
  console.log('  JIRA_API_TOKEN - Your Jira API token');
  process.exit(1);
}

/**
 * Check if required environment variables are set
 */
function checkEnvironment() {
  const required = ['JIRA_BASE_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Error: Required environment variables not set:');
    missing.forEach((key) => console.error(`  ${key}`));
    process.exit(1);
  }
}

/**
 * Make authenticated HTTP request to Jira API
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<Object>} Response data
 */
async function jiraApiCall(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${process.env.JIRA_BASE_URL}/rest/api/3/${endpoint}`);
    const auth = Buffer.from(
      `${process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`,
    ).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': CONFIG.userAgent,
      },
      timeout: CONFIG.timeout,
    };

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(
              new Error(`HTTP ${res.statusCode}: ${jsonData.errorMessages?.join(', ') || data}`),
            );
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Format attachments information
 * @param {Array} attachments - Attachments array
 * @returns {string} Formatted attachments
 */
function formatAttachments(attachments) {
  let output = '## Attachments\n';

  if (!attachments || attachments.length === 0) {
    output += 'No attachments\n';
  } else {
    attachments.forEach((attachment) => {
      const sizeKB = Math.round(attachment.size / 1024);
      output += `- **${attachment.filename}** (${sizeKB} KB) - [Download](${attachment.content})\n`;
    });
  }

  return output + '\n';
}

/**
 * Format comments information
 * @param {Object} commentsData - Comments data
 * @returns {string} Formatted comments
 */
function formatComments(commentsData) {
  let output = '## Comments\n';

  if (!commentsData?.comments || commentsData.comments.length === 0) {
    output += 'No comments\n';
  } else {
    commentsData.comments.forEach((comment) => {
      const author = comment.author?.displayName || 'Unknown';
      const created = new Date(comment.created).toLocaleString();
      const body = comment.body?.content?.[0]?.content?.[0]?.text || comment.body || 'No content';

      output += `- **${author}** (${created}): ${body}\n`;
    });
  }

  return output + '\n';
}

/**
 * Format work log information
 * @param {Object} worklogData - Work log data
 * @returns {string} Formatted work log
 */
function formatWorklog(worklogData) {
  let output = '## Work Log\n';

  if (!worklogData?.worklogs || worklogData.worklogs.length === 0) {
    output += 'No work logged\n';
  } else {
    worklogData.worklogs.forEach((worklog) => {
      const author = worklog.author?.displayName || 'Unknown';
      const timeSpent = worklog.timeSpent || 'No time logged';
      const comment = worklog.comment || 'No comment';

      output += `- **${author}** (${timeSpent}) - ${comment}\n`;
    });
  }

  return output + '\n';
}

/**
 * Format linked issues
 * @param {Array} linkedIssues - Linked issues array
 * @returns {string} Formatted linked issues
 */
function formatLinkedIssues(linkedIssues) {
  let output = '## Linked Issues\n';

  if (!linkedIssues || linkedIssues.length === 0) {
    output += 'No linked issues\n';
  } else {
    linkedIssues.forEach((link) => {
      const linkType = link.type?.name || 'Unknown';
      const issue = link.outwardIssue || link.inwardIssue;
      const issueKey = issue?.key || 'Unknown';
      const issueSummary = issue?.fields?.summary || 'No summary';

      output += `- **${linkType}**: ${issueKey} - ${issueSummary}\n`;
    });
  }

  return output + '\n';
}

/**
 * Format subtasks
 * @param {Array} subtasks - Subtasks array
 * @returns {string} Formatted subtasks
 */
function formatSubtasks(subtasks) {
  let output = '## Subtasks\n';

  if (!subtasks || subtasks.length === 0) {
    output += 'No subtasks\n';
  } else {
    subtasks.forEach((subtask) => {
      const key = subtask.key || 'Unknown';
      const summary = subtask.fields?.summary || 'No summary';
      const status = subtask.fields?.status?.name || 'Unknown status';

      output += `- **${key}**: ${summary} (${status})\n`;
    });
  }

  return output + '\n';
}

/**
 * Extract text content from Jira's content structure
 * @param {Object} content - Jira content object
 * @returns {string} Extracted text
 */
function extractTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (content?.content) {
    return content.content.map(extractTextContent).join('');
  }

  if (content?.text) {
    return content.text;
  }

  return '';
}

/**
 * Main function to fetch and display ticket details
 * @param {string} ticketId - Jira ticket ID
 */
async function main(ticketId) {
  try {
    console.log(`Fetching details for ticket: ${ticketId}`);
    console.log('==========================================');

    // Fetch basic ticket information
    console.log('Fetching ticket details...');
    const ticketDetails = await jiraApiCall(`issue/${ticketId}`);

    // Extract key information
    const fields = ticketDetails.fields;
    const summary = fields.summary || 'No summary';
    const description = fields.description
      ? extractTextContent(fields.description)
      : 'No description';
    const status = fields.status?.name || 'Unknown';
    const priority = fields.priority?.name || 'Unknown';
    const assignee = fields.assignee?.displayName || 'Unassigned';
    const reporter = fields.reporter?.displayName || 'Unknown';
    const created = new Date(fields.created).toLocaleString();
    const updated = new Date(fields.updated).toLocaleString();
    const issueType = fields.issuetype?.name || 'Unknown';
    const labels = fields.labels?.join(', ') || '';
    const components = fields.components?.map((c) => c.name).join(', ') || '';
    const fixVersions = fields.fixVersions?.map((v) => v.name).join(', ') || '';
    const storyPoints = fields.customfield_10016 || 'Not set';

    // Display formatted information
    console.log(`# Jira Ticket: ${ticketId}`);
    console.log('');
    console.log(`**Summary:** ${summary}`);
    console.log(`**Status:** ${status}`);
    console.log(`**Priority:** ${priority}`);
    console.log(`**Type:** ${issueType}`);
    console.log(`**Assignee:** ${assignee}`);
    console.log(`**Reporter:** ${reporter}`);
    console.log(`**Created:** ${created}`);
    console.log(`**Updated:** ${updated}`);
    console.log(`**Story Points:** ${storyPoints}`);
    console.log('');

    if (labels) {
      console.log(`**Labels:** ${labels}`);
      console.log('');
    }

    if (components) {
      console.log(`**Components:** ${components}`);
      console.log('');
    }

    if (fixVersions) {
      console.log(`**Fix Versions:** ${fixVersions}`);
      console.log('');
    }

    // Description
    console.log('## Description');
    console.log(description || 'No description provided');
    console.log('');

    // Fetch and display attachments
    console.log('Fetching attachments...');
    const attachments = fields.attachment || [];
    console.log(formatAttachments(attachments));

    // Fetch and display comments
    console.log('Fetching comments...');
    const comments = await jiraApiCall(`issue/${ticketId}/comment`);
    console.log(formatComments(comments));

    // Fetch and display work log
    console.log('Fetching work log...');
    const worklog = await jiraApiCall(`issue/${ticketId}/worklog`);
    console.log(formatWorklog(worklog));

    // Display linked issues
    console.log('Fetching linked issues...');
    const linkedIssues = fields.issuelinks || [];
    console.log(formatLinkedIssues(linkedIssues));

    // Display subtasks
    console.log('Fetching subtasks...');
    const subtasks = fields.subtasks || [];
    console.log(formatSubtasks(subtasks));

    // Display full JSON for debugging (optional)
    if (process.env.DEBUG === 'true') {
      console.log('## Full Ticket Details (JSON)');
      console.log('```json');
      console.log(JSON.stringify(ticketDetails, null, 2));
      console.log('```');
      console.log('');
    }

    console.log('==========================================');
    console.log('Ticket details fetched successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  usage();
}

const ticketId = args[0];

// Check environment variables
checkEnvironment();

// Run main function
main(ticketId);
