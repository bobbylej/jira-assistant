# PR Analysis Script

## Purpose

The `analyze-pr.js` script leverages Google Claude AI to analyze pull request changes by combining git diff output with Jira ticket details. It provides comprehensive insights including business logic summary, QA testing guidelines, potential risks, and environment variable changes to help teams ensure quality and successful deployments.

## GitHub Workflow Integration

### Usage in GitHub Actions

The script is designed to be integrated into GitHub Actions workflows, particularly as an extension to the existing `get-pr-diff.yml` workflow:

```yaml
- name: Analyze PR Changes
  run: |
    node scripts/analyze-pr/analyze-pr.js "${{ steps.get-diff.outputs.diff }}" "${{ steps.get-jira-details.outputs.details }}"
  env:
    CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

### Complete Workflow Integration Example

Here's how to extend the existing `get-pr-diff.yml` workflow:

```yaml
jobs:
  get-pr-diff:
    runs-on: ubuntu-latest
    outputs:
      code-diff: ${{ steps.get-diff.outputs.diff }}
      jira-ticket: ${{ steps.get-jira-ticket.outputs.ticket }}
      jira-details: ${{ steps.get-jira-details.outputs.details }}
      pr-analysis: ${{ steps.analyze-pr.outputs.analysis }}
    steps:
      # ... existing steps ...

      - name: Analyze PR Changes
        id: analyze-pr
        if: steps.get-diff.outputs.diff != ''
        run: |
          # Analyze PR using Claude AI
          ANALYSIS=$(node ./scripts/analyze-pr/analyze-pr.js "${{ steps.get-diff.outputs.diff }}" "${{ steps.get-jira-details.outputs.details }}")

          # Set output
          echo "analysis<<EOF" >> $GITHUB_OUTPUT
          echo "$ANALYSIS" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}

      - name: Comment PR with Analysis
        if: steps.analyze-pr.outputs.analysis != ''
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🤖 AI-Powered PR Analysis\n\n${{ steps.analyze-pr.outputs.analysis }}`
            })
```

### Workflow Integration Steps

1. **Get Git Diff** - Extract code changes from the pull request
2. **Get Jira Details** - Fetch comprehensive ticket information (optional)
3. **Analyze Changes** - This script processes both inputs using Claude AI
4. **Output Analysis** - Structured markdown analysis for team review
5. **Comment on PR** - Automatically post analysis as PR comment (optional)

### Required GitHub Secrets

Configure these secrets in your repository settings:

- `CLAUDE_API_KEY` - Your Anthropic Claude API key (get from [Anthropic Console](https://console.anthropic.com/))

### Optional GitHub Secrets

If using Jira integration:

- `JIRA_BASE_URL` - Your Jira instance URL
- `JIRA_USER_EMAIL` - Your Jira account email
- `JIRA_API_TOKEN` - Your Jira API token

## Testing

### Automated Tests

Run the comprehensive test suite to validate all functionality:

```bash
cd scripts/analyze-pr
node analyze-pr.test.js
```

**Test Coverage:**

- ✅ Script structure and main function validation
- ✅ Input validation and error handling
- ✅ Environment variable validation
- ✅ Data processing and prompt generation
- ✅ Error handling for edge cases
- ✅ Debug mode functionality

### Manual Testing

Test with real data by setting environment variables:

```bash
export CLAUDE_API_KEY="your-claude-api-key"

# Test with git diff and Jira details
GIT_DIFF=$(git diff HEAD~1)
JIRA_DETAILS=$(cat sample-jira-details.md)

node analyze-pr.js "$GIT_DIFF" "$JIRA_DETAILS"
```

### Test with Sample Data

Create sample files for testing:

```bash
# Create sample git diff
cat > sample-diff.txt << 'EOF'
diff --git a/src/components/UserProfile.tsx b/src/components/UserProfile.tsx
index 1234567..abcdefg 100644
--- a/src/components/UserProfile.tsx
+++ b/src/components/UserProfile.tsx
@@ -1,5 +1,15 @@
 import React from 'react';
+import { useState, useEffect } from 'react';
+import { fetchUserProfile } from '../api/user';

 export const UserProfile = () => {
+  const [user, setUser] = useState(null);
+  const [loading, setLoading] = useState(true);
+
+  useEffect(() => {
+    fetchUserProfile().then(setUser).finally(() => setLoading(false));
+  }, []);
+
   return (
-    <div>User Profile</div>
+    <div>{loading ? 'Loading...' : `Hello, ${user?.name}`}</div>
   );
 };
EOF

# Create sample Jira details
cat > sample-jira.md << 'EOF'
# Jira Ticket: SPREE-456

**Summary:** Implement user profile loading state
**Status:** In Progress
**Priority:** Medium
**Type:** Story

## Description
Add proper loading states and error handling to the user profile component
to improve user experience when fetching user data from the API.

## Acceptance Criteria
- Show loading indicator while fetching user data
- Display user name when data is loaded
- Handle API errors gracefully
EOF

# Test the script
node analyze-pr.js "$(cat sample-diff.txt)" "$(cat sample-jira.md)"
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
DEBUG=true node analyze-pr.js "$GIT_DIFF" "$JIRA_DETAILS"
```

Debug mode provides additional information about:

- Input validation results
- Prompt generation process
- API request/response details
- Processing steps and timing

## Output Format

The script generates a structured markdown analysis with the following sections:

### Business Logic Summary

- Concise overview of implemented functionality
- Connection between code changes and business requirements

### QA Testing Guidelines

- **Feature Testing**: New functionality to validate
- **Regression Testing**: Existing features that might be affected
- **Edge Cases**: Error scenarios and boundary conditions
- **Integration Testing**: API and service integrations to test
- **UI/UX Testing**: User interface changes to validate

### Potential Risks

- **Performance Impact**: Performance considerations and bottlenecks
- **Security Concerns**: Security-related changes or vulnerabilities
- **Breaking Changes**: Changes that might affect existing functionality
- **Dependencies**: New or updated dependencies and their risks
- **Database Changes**: Schema changes and migration risks

### Environment Variables

- **Added**: New environment variables introduced
- **Modified**: Existing variables that were changed
- **Removed**: Variables that were removed
- **Required**: Variables needed for the feature to work

### Additional Notes

- Important observations for the development team
- Deployment considerations
- Monitoring and observability recommendations

## Configuration

### API Configuration

The script uses Claude 3.5 Sonnet model by default. You can modify the configuration in the script:

```javascript
const CONFIG = {
  timeout: 60000, // API timeout in milliseconds
  model: 'claude-3-5-sonnet-20241022', // Claude model version
  maxTokens: 4000, // Maximum response tokens
};
```

### Input Limits

- **Git Diff Size**: Automatically validates input size to stay within API limits
- **Combined Input**: Approximately 100,000 tokens maximum (diff + Jira details)
- **Timeout**: 60-second timeout for API responses

## Error Handling

The script includes comprehensive error handling for:

- Missing or invalid API credentials
- Empty or malformed input data
- API rate limiting and timeouts
- Network connectivity issues
- Input size exceeding limits

## Best Practices

### For Development Teams

1. **Review Analysis**: Always review AI-generated analysis for accuracy
2. **Combine with Human Review**: Use as a supplement to, not replacement for, human code review
3. **Update Prompts**: Customize the analysis prompt for your specific needs
4. **Monitor API Usage**: Track Claude API usage and costs
5. **Validate Outputs**: Cross-check environment variable changes and risk assessments

### For CI/CD Integration

1. **Fail Gracefully**: Don't fail the entire pipeline if analysis fails
2. **Cache Results**: Consider caching analysis results for the same diff
3. **Rate Limiting**: Implement rate limiting for API calls
4. **Cost Management**: Monitor and set budgets for API usage
5. **Fallback Options**: Have fallback analysis methods if API is unavailable

## Troubleshooting

### Common Issues

**"Required environment variables not set"**

- Ensure `CLAUDE_API_KEY` is properly configured in GitHub secrets
- Verify the secret name matches exactly in your workflow

**"Request timeout"**

- Large diffs may take longer to process
- Consider breaking down large PRs into smaller changes
- Check network connectivity and API status

**"Input is too large for analysis"**

- Reduce the size of the git diff
- Focus on specific file changes
- Provide a summary instead of full diff for very large changes

**"Claude API analysis failed"**

- Verify your API key is valid and has sufficient credits
- Check Anthropic API status page
- Ensure your API key has the correct permissions

### Getting Help

1. Check the test suite output for specific error details
2. Enable debug mode to see detailed processing information
3. Verify all environment variables are correctly set
4. Review the Anthropic Claude API documentation for rate limits and usage guidelines
