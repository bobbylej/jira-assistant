# Jira Ticket Details Script

## Purpose

The `get-jira-ticket-details.js` script fetches comprehensive information from Jira tickets via the Jira REST API. It extracts ticket metadata, descriptions, attachments, comments, work logs, and related issues, formatting them for use in GitHub Actions workflows and other automation tools.

## GitHub Workflow Integration

### Usage in GitHub Actions

The script is designed to be used in GitHub Actions workflows, particularly in the `get-pr-diff.yml` workflow:

```yaml
- name: Get Jira Ticket Details
  run: |
    node scripts/get-jira-ticket-details/get-jira-ticket-details.js "${{ steps.extract-ticket.outputs.ticket_id }}"
  env:
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_USER_EMAIL: ${{ secrets.JIRA_USER_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
```

### Workflow Integration Steps

1. **Extract Ticket ID** - The workflow extracts Jira ticket ID from PR title or branch name
2. **Fetch Details** - This script retrieves comprehensive ticket information
3. **Output Data** - Ticket details are provided as workflow outputs for downstream jobs
4. **Error Handling** - Graceful failure if credentials are missing or ticket doesn't exist

### Required GitHub Secrets

Configure these secrets in your repository settings:

- `JIRA_BASE_URL` - Your Jira instance URL (e.g., `https://yourcompany.atlassian.net`)
- `JIRA_USER_EMAIL` - Your Jira account email
- `JIRA_API_TOKEN` - Your Jira API token (generate from Jira account settings)

## Testing

### Automated Tests

Run the essential test suite to validate core functionality:

```bash
cd scripts/get-jira-ticket-details
node get-jira-ticket-details.test.js
```

**Test Coverage:**

- ✅ Script structure and main function
- ✅ Input validation and error handling
- ✅ JSON parsing and data formatting
- ✅ Environment variable validation

### Manual Testing

Test with real Jira data by setting environment variables:

```bash
export JIRA_BASE_URL="https://yourcompany.atlassian.net"
export JIRA_USER_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"

node get-jira-ticket-details/get-jira-ticket-details.js "SPREE-123"
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
DEBUG=true node get-jira-ticket-details/get-jira-ticket-details.js "SPREE-123"
```

## Output Format

The script outputs structured ticket information including:

- **Summary** - Ticket title and key metadata
- **Status & Priority** - Current workflow state
- **Description** - Parsed content from Jira's JSON format
- **Attachments** - Files with download links
- **Comments** - Discussion thread with timestamps
- **Work Log** - Time tracking entries
- **Linked Issues** - Related tickets and dependencies
- **Subtasks** - Child ticket information
