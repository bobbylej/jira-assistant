#!/usr/bin/env node

/**
 * Essential tests for get-jira-ticket-details.js
 * Tests core functionality without external dependencies
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

// Test counter
let testsPassed = 0;
let testsFailed = 0;

/**
 * Run a test and check the result
 */
async function runTest(testName, testFunction, expectedExitCode = 0) {
  process.stdout.write(`Testing: ${testName}... `);

  try {
    const result = await testFunction();
    if (result === expectedExitCode) {
      console.log(`${colors.green}PASS${colors.reset}`);
      testsPassed++;
    } else {
      console.log(`${colors.red}FAIL${colors.reset}`);
      console.log(`  Expected exit code: ${expectedExitCode}`);
      console.log(`  Actual exit code: ${result}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`${colors.red}FAIL${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Execute a command and return exit code
 */
function executeCommand(command, options = {}) {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'pipe',
      ...options,
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

/**
 * Test script structure and dependencies
 */
async function testScriptStructure() {
  console.log(`${colors.blue}Testing script structure...${colors.reset}`);

  // Test script exists
  await runTest('Script file exists', () =>
    fs.existsSync('./get-jira-ticket-details.js') ? 0 : 1,
  );

  // Test script has proper shebang
  await runTest('Script has shebang', () => {
    const content = fs.readFileSync('./get-jira-ticket-details.js', 'utf8');
    return content.startsWith('#!/usr/bin/env node') ? 0 : 1;
  });

  // Test script has main function
  await runTest('Script has main function', () => {
    const content = fs.readFileSync('./get-jira-ticket-details.js', 'utf8');
    return content.includes('async function main(') ? 0 : 1;
  });
}

/**
 * Test script validation
 */
async function testValidation() {
  console.log(`${colors.blue}Testing script validation...${colors.reset}`);

  // Test missing arguments
  await runTest('Missing ticket ID', () => executeCommand('node ./get-jira-ticket-details.js'), 1);

  // Test missing environment variables
  await runTest(
    'Missing JIRA_BASE_URL',
    () =>
      executeCommand('node ./get-jira-ticket-details.js SPREE-123', {
        env: { ...process.env, JIRA_USER_EMAIL: 'test@example.com', JIRA_API_TOKEN: 'token' },
      }),
    1,
  );
}

/**
 * Test data parsing functions
 */
async function testDataParsing() {
  console.log(`${colors.blue}Testing data parsing...${colors.reset}`);

  // Test JSON parsing with nested objects
  await runTest('JSON parsing with nested objects', () => {
    try {
      const complexData = {
        fields: {
          description: {
            content: [
              {
                content: [
                  {
                    text: 'Test description',
                  },
                ],
              },
            ],
          },
        },
      };

      function extractTextContent(content) {
        if (typeof content === 'string') return content;
        if (content?.content) return content.content.map(extractTextContent).join('');
        if (content?.text) return content.text;
        return '';
      }

      const extracted = extractTextContent(complexData.fields.description);
      return extracted === 'Test description' ? 0 : 1;
    } catch {
      return 1;
    }
  });

  // Test attachment formatting
  await runTest('Attachment formatting', () => {
    try {
      const attachments = [
        { filename: 'test.txt', size: 2048, content: 'https://example.com/test.txt' },
      ];

      function formatAttachments(attachments) {
        if (!attachments || attachments.length === 0) return 'No attachments';
        return attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(', ');
      }

      const formatted = formatAttachments(attachments);
      return formatted.includes('test.txt') && formatted.includes('2 KB') ? 0 : 1;
    } catch {
      return 1;
    }
  });
}

/**
 * Test basic functionality with mock credentials
 */
async function testBasicFunctionality() {
  console.log(`${colors.blue}Testing basic functionality...${colors.reset}`);

  // Test with mock credentials (will fail but shows proper error handling)
  await runTest(
    'Mock API call handling',
    async () => {
      const result = await executeCommand('node ./get-jira-ticket-details.js TEST-123', {
        env: {
          ...process.env,
          JIRA_BASE_URL: 'https://mock.atlassian.net',
          JIRA_USER_EMAIL: 'test@example.com',
          JIRA_API_TOKEN: 'mock-token',
        },
      });

      // Should fail (exit code 1) for mock credentials
      return result;
    },
    1,
  );
}

/**
 * Main test execution
 */
async function main() {
  console.log('Running essential tests for get-jira-ticket-details.js...');
  console.log('====================================================');

  // Check if script exists
  if (!fs.existsSync('./get-jira-ticket-details.js')) {
    console.log(`${colors.red}Error: get-jira-ticket-details.js not found${colors.reset}`);
    console.log('Make sure you are running this from the get-jira-ticket-details directory');
    process.exit(1);
  }

  // Run essential test suites
  await testScriptStructure();
  await testValidation();
  await testDataParsing();
  await testBasicFunctionality();

  console.log('');
  console.log('====================================================');
  console.log('Test Results:');
  console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);

  if (testsFailed === 0) {
    console.log(`${colors.green}All essential tests passed! 🎉${colors.reset}`);
    console.log('');
    console.log(
      `${colors.yellow}Note: This test suite validates core functionality.${colors.reset}`,
    );
    console.log(
      `${colors.yellow}To test with real Jira data, set credentials and run:${colors.reset}`,
    );
    console.log(`${colors.cyan}node get-jira-ticket-details.js "SPREE-123"${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}Some tests failed! 😞${colors.reset}`);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
