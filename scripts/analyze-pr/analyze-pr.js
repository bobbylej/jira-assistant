#!/usr/bin/env node

/**
 * Script to analyze pull request changes using Google Claude API
 * Usage: node analyze-pr.js <git_diff> <jira_details>
 * Example: node analyze-pr.js "$(cat diff.txt)" "$(cat jira.md)"
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Configuration
const CONFIG = {
  timeout: 60000, // 60 seconds for AI processing
  userAgent: "PR-Analysis-Script/1.0",
  claudeApiUrl: "https://api.anthropic.com/v1/messages",
  maxTokens: 4000,
  model: "claude-sonnet-4-20250514",
};

/**
 * Display usage information
 */
function usage() {
  console.log("Usage: node analyze-pr.js <git_diff> <jira_details>");
  console.log(
    'Example: node analyze-pr.js "$(git diff)" "$(cat jira-details.md)"'
  );
  console.log("");
  console.log("Required environment variables:");
  console.log("  CLAUDE_API_KEY - Your Anthropic Claude API key");
  console.log("");
  console.log("Optional environment variables:");
  console.log('  DEBUG - Set to "true" to enable debug output');
  process.exit(1);
}

/**
 * Check if required environment variables are set
 */
function checkEnvironment() {
  const required = ["CLAUDE_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Error: Required environment variables not set:");
    missing.forEach((key) => console.error(`  ${key}`));
    process.exit(1);
  }
}

/**
 * Make authenticated HTTP request to Claude API
 * @param {Object} payload - Request payload
 * @returns {Promise<Object>} Response data
 */
async function claudeApiCall(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.claudeApiUrl);
    const postData = JSON.stringify(payload);
    const apiKey = process.env.CLAUDE_API_KEY;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": CONFIG.userAgent,
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      timeout: CONFIG.timeout,
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${jsonData.error?.message || data}`
              )
            );
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Create the analysis prompt for Claude
 * @param {string} gitDiff - Git diff content
 * @param {string} jiraDetails - Jira ticket details
 * @returns {string} Formatted prompt
 */
function createAnalysisPrompt(gitDiff, jiraDetails) {
  return `You are a senior software engineer reviewing a pull request. Please analyze the provided git diff and Jira ticket details to create a comprehensive PR analysis.

## Git Diff:
\`\`\`diff
${gitDiff}
\`\`\`

## Jira Ticket Details:
${jiraDetails}

Please provide a structured analysis in the following markdown format:

# Pull Request Analysis

## Business Logic Summary
Provide a concise summary (2-3 sentences) of what business logic was implemented in this PR based on the code changes and Jira ticket.

## QA Testing Guidelines
List specific areas and scenarios that QA testers should focus on to ensure everything works as expected:
- **Feature Testing**: What new functionality should be tested
- **Regression Testing**: What existing functionality might be affected
- **Edge Cases**: What edge cases or error scenarios should be tested
- **Integration Testing**: What integrations or APIs should be tested
- **UI/UX Testing**: What user interface changes should be validated (if applicable)

## Potential Risks
Identify any potential risks or concerns from the code changes:
- **Performance Impact**: Any performance considerations
- **Security Concerns**: Any security-related changes or risks
- **Breaking Changes**: Any changes that might break existing functionality
- **Dependencies**: New dependencies or version changes that might cause issues
- **Database Changes**: Any database schema or data migration risks

## Environment Variables
List any environment variables that were:
- **Added**: New environment variables introduced
- **Modified**: Existing environment variables that were changed
- **Removed**: Environment variables that were removed
- **Required**: Environment variables that need to be set for this feature to work

If no environment variables were changed, state "No environment variable changes detected."

## Additional Notes
Any other important observations or recommendations for the development team.

Please be thorough but concise. Focus on actionable insights that will help the team ensure quality and successful deployment.`;
}

/**
 * Analyze PR using Claude API
 * @param {string} gitDiff - Git diff content
 * @param {string} jiraDetails - Jira ticket details
 * @returns {Promise<string>} Analysis result
 */
async function analyzePR(gitDiff, jiraDetails) {
  if (process.env.DEBUG === "true") {
    console.log("Creating analysis prompt...");
  }

  const prompt = createAnalysisPrompt(gitDiff, jiraDetails);

  const payload = {
    model: CONFIG.model,
    max_tokens: CONFIG.maxTokens,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  if (process.env.DEBUG === "true") {
    console.log("Sending request to Claude API...");
    console.log("Payload:", JSON.stringify(payload, null, 2));
  }

  try {
    const response = await claudeApiCall(payload);

    if (process.env.DEBUG === "true") {
      console.log("Claude API response:", JSON.stringify(response, null, 2));
    }

    return response.content[0].text;
  } catch (error) {
    throw new Error(`Claude API analysis failed: ${error.message}`);
  }
}

/**
 * Validate input parameters
 * @param {string} gitDiff - Git diff content
 * @param {string} jiraDetails - Jira ticket details
 */
function validateInputs(gitDiff, jiraDetails) {
  if (!gitDiff || gitDiff.trim().length === 0) {
    throw new Error("Git diff is empty or not provided");
  }

  if (!jiraDetails || jiraDetails.trim().length === 0) {
    console.warn(
      "Warning: Jira details are empty or not provided. Analysis will be based on git diff only."
    );
  }

  // Check if git diff is too large (Claude has token limits)
  const estimatedTokens = (gitDiff.length + jiraDetails.length) / 4; // Rough estimation
  if (estimatedTokens > 100000) {
    // Conservative limit
    throw new Error(
      "Input is too large for analysis. Please provide a smaller diff or summary."
    );
  }
}

/**
 * Main function to analyze PR
 * @param {string} gitDiff - Git diff content
 * @param {string} jiraDetails - Jira ticket details
 */
async function main(gitDiff, jiraDetails) {
  try {
    if (process.env.DEBUG === "true") {
      console.log("Starting PR analysis...");
      console.log("Git diff length:", gitDiff.length);
      console.log("Jira details length:", jiraDetails.length);
    }

    // Validate inputs
    validateInputs(gitDiff, jiraDetails);

    // Analyze PR using Claude
    const analysis = await analyzePR(gitDiff, jiraDetails);

    // Output the analysis
    console.log(analysis);

    if (process.env.DEBUG === "true") {
      console.log("PR analysis completed successfully!");
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  usage();
}

const gitDiff = args[0] || "";
const jiraDetails = args[1] || "";

// Check environment variables
checkEnvironment();

// Run main function
main(gitDiff, jiraDetails);
