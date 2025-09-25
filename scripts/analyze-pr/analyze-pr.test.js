#!/usr/bin/env node

/**
 * Test suite for analyze-pr.js script
 * Usage: node analyze-pr.test.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  scriptPath: path.join(__dirname, 'analyze-pr.js'),
  timeout: 30000,
};

// Test data
const TEST_DATA = {
  validGitDiff: `diff --git a/src/components/UserProfile.tsx b/src/components/UserProfile.tsx
index 1234567..abcdefg 100644
--- a/src/components/UserProfile.tsx
+++ b/src/components/UserProfile.tsx
@@ -1,5 +1,10 @@
 import React from 'react';
+import { useState } from 'react';
 
 export const UserProfile = () => {
+  const [isLoading, setIsLoading] = useState(false);
+  
   return (
-    <div>User Profile</div>
+    <div>
+      {isLoading ? 'Loading...' : 'User Profile'}
+    </div>
   );
 };`,

  validJiraDetails: `# Jira Ticket: SPREE-123

**Summary:** Add loading state to user profile component
**Status:** In Progress
**Priority:** Medium
**Type:** Story
**Assignee:** John Doe
**Reporter:** Jane Smith

## Description
Add a loading state indicator to the user profile component to improve user experience when data is being fetched.

## Acceptance Criteria
- Display loading indicator when profile data is being fetched
- Hide loading indicator when data is loaded
- Show appropriate error message if loading fails`,

  emptyGitDiff: '',

  emptyJiraDetails: '',

  largeGitDiff: 'diff --git a/large-file.js b/large-file.js\n' + 'a'.repeat(500000), // Very large diff
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

/**
 * Run a command and return promise with result
 * @param {string} command - Command to run
 * @param {Array} args - Command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<Object>} Result object
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      timeout: TEST_CONFIG.timeout,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0,
      });
    });

    child.on('error', (error) => {
      resolve({
        code: -1,
        stdout,
        stderr: error.message,
        success: false,
      });
    });
  });
}

/**
 * Assert test condition
 * @param {boolean} condition - Condition to test
 * @param {string} message - Test message
 */
function assert(condition, message) {
  testResults.total++;

  if (condition) {
    console.log(`✅ PASS: ${message}`);
    testResults.passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    testResults.failed++;
  }
}

/**
 * Test script structure and basic functionality
 */
async function testScriptStructure() {
  console.log('\n📋 Testing script structure...');

  // Test if script file exists
  const scriptExists = fs.existsSync(TEST_CONFIG.scriptPath);
  assert(scriptExists, 'Script file exists');

  if (!scriptExists) {
    return;
  }

  // Test if script is executable
  const stats = fs.statSync(TEST_CONFIG.scriptPath);
  const isExecutable = !!(stats.mode & parseInt('111', 8));
  assert(isExecutable, 'Script has executable permissions');

  // Test script content structure
  const scriptContent = fs.readFileSync(TEST_CONFIG.scriptPath, 'utf8');
  assert(scriptContent.includes('#!/usr/bin/env node'), 'Script has proper shebang');
  assert(scriptContent.includes('function usage()'), 'Script has usage function');
  assert(
    scriptContent.includes('function checkEnvironment()'),
    'Script has environment check function',
  );
  assert(scriptContent.includes('function main('), 'Script has main function');
  assert(scriptContent.includes('CLAUDE_API_KEY'), 'Script references Claude API key');
}

/**
 * Test input validation
 */
async function testInputValidation() {
  console.log('\n🔍 Testing input validation...');

  // Test no arguments
  const noArgsResult = await runCommand('node', [TEST_CONFIG.scriptPath]);
  assert(!noArgsResult.success, 'Script fails with no arguments');
  assert(
    noArgsResult.stdout.includes('Usage:') || noArgsResult.stderr.includes('Usage:'),
    'Shows usage when no arguments provided',
  );

  // Test missing environment variables
  const noEnvResult = await runCommand('node', [TEST_CONFIG.scriptPath, 'test-diff'], {
    env: { PATH: process.env.PATH }, // Only keep PATH, remove other env vars
  });
  assert(!noEnvResult.success, 'Script fails without required environment variables');
  assert(
    noEnvResult.stderr.includes('CLAUDE_API_KEY') || noEnvResult.stdout.includes('CLAUDE_API_KEY'),
    'Shows missing environment variable error',
  );
}

/**
 * Test data processing functions
 */
async function testDataProcessing() {
  console.log('\n⚙️ Testing data processing...');

  // Test with valid inputs (will fail API call but should validate inputs)
  const validInputResult = await runCommand(
    'node',
    [TEST_CONFIG.scriptPath, TEST_DATA.validGitDiff, TEST_DATA.validJiraDetails],
    {
      env: { ...process.env, CLAUDE_API_KEY: 'test-key' },
    },
  );

  // Should fail at API call, not input validation
  assert(
    validInputResult.stderr.includes('Claude API') ||
      validInputResult.stderr.includes('Request failed') ||
      validInputResult.stderr.includes('HTTP'),
    'Fails at API call stage with valid inputs (expected behavior without real API key)',
  );

  // Test with empty git diff
  const emptyDiffResult = await runCommand(
    'node',
    [TEST_CONFIG.scriptPath, TEST_DATA.emptyGitDiff, TEST_DATA.validJiraDetails],
    {
      env: { ...process.env, CLAUDE_API_KEY: 'test-key' },
    },
  );
  assert(!emptyDiffResult.success, 'Script fails with empty git diff');
  assert(
    emptyDiffResult.stderr.includes('empty') || emptyDiffResult.stderr.includes('not provided'),
    'Shows appropriate error for empty git diff',
  );
}

/**
 * Test prompt generation
 */
async function testPromptGeneration() {
  console.log('\n📝 Testing prompt generation...');

  // Read the script content to check if prompt generation function exists
  const scriptContent = fs.readFileSync(TEST_CONFIG.scriptPath, 'utf8');

  // Test that the createAnalysisPrompt function exists and has the right structure
  assert(
    scriptContent.includes('function createAnalysisPrompt('),
    'Script has createAnalysisPrompt function',
  );
  assert(
    scriptContent.includes('Business Logic Summary'),
    'Prompt template includes Business Logic Summary section',
  );
  assert(
    scriptContent.includes('QA Testing Guidelines'),
    'Prompt template includes QA Testing Guidelines section',
  );
  assert(
    scriptContent.includes('Potential Risks'),
    'Prompt template includes Potential Risks section',
  );
  assert(
    scriptContent.includes('Environment Variables'),
    'Prompt template includes Environment Variables section',
  );

  // Test that the prompt uses the input parameters
  assert(scriptContent.includes('${gitDiff}'), 'Prompt template includes git diff placeholder');
  assert(
    scriptContent.includes('${jiraDetails}'),
    'Prompt template includes Jira details placeholder',
  );
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n🚨 Testing error handling...');

  // Test with very large input (should be rejected)
  const largeInputResult = await runCommand(
    'node',
    [TEST_CONFIG.scriptPath, TEST_DATA.largeGitDiff, TEST_DATA.validJiraDetails],
    {
      env: { ...process.env, CLAUDE_API_KEY: 'test-key' },
    },
  );
  assert(!largeInputResult.success, 'Script rejects very large input');
  assert(
    largeInputResult.stderr.includes('too large') || largeInputResult.stderr.includes('limit'),
    'Shows appropriate error for large input',
  );
}

/**
 * Test debug mode
 */
async function testDebugMode() {
  console.log('\n🐛 Testing debug mode...');

  const debugResult = await runCommand(
    'node',
    [TEST_CONFIG.scriptPath, TEST_DATA.validGitDiff, TEST_DATA.validJiraDetails],
    {
      env: { ...process.env, CLAUDE_API_KEY: 'test-key', DEBUG: 'true' },
    },
  );

  // Should show debug output even if API call fails
  assert(
    debugResult.stdout.includes('Starting PR analysis') ||
      debugResult.stderr.includes('Starting PR analysis'),
    'Shows debug output when DEBUG=true',
  );
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting PR Analysis Script Tests');
  console.log('=====================================');

  await testScriptStructure();
  await testInputValidation();
  await testDataProcessing();
  await testPromptGeneration();
  await testErrorHandling();
  await testDebugMode();

  // Print results
  console.log('\n📊 Test Results');
  console.log('===============');
  console.log(`Total tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testResults,
};
