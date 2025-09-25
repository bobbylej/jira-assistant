# Jira Ticket ID Extraction Scripts

This directory contains scripts for extracting Jira ticket IDs from PR titles and branch names.

## Files

- `get-jira-ticket-id.sh` - Main script that extracts Jira ticket IDs
- `get-jira-ticke-idt.test.sh` - Test suite for the extraction script
- `get-jira-ticket-id.docs.md` - This documentation

## Usage

### Main Script

```bash
./get-jira-ticket-id/get-jira-ticket-id.sh <project_key> <pr_title> <branch_name>
```

**Parameters:**

- `project_key` - The Jira project key (e.g., "SPREE")
- `pr_title` - The pull request title
- `branch_name` - The branch name

**Example:**

```bash
./get-jira-ticket-id/get-jira-ticket-id.sh "SPREE" "Fix bug in spree-123" "feature/implementation"
```

**Output:**

- Prints "Found Jira ticket: SPREE-123" if found
- Returns the ticket ID (e.g., "SPREE-123") as the last line
- Returns empty string if no ticket found

### Test Script

```bash
cd scripts/get-jira-ticket-id
./get-jira-ticket-id.test.sh
```

Runs a comprehensive test suite covering various scenarios:

- Case insensitive matching
- PR title vs branch name precedence
- Multiple tickets (returns first match)
- Different project keys
- Empty inputs
- No ticket found scenarios

## How It Works

1. **Regex Pattern**: Uses `(?i)${PROJECT_KEY}-[0-9]+` for case-insensitive matching
2. **Search Order**: PR title first, then branch name
3. **Normalization**: Converts result to uppercase for consistency
4. **Multiple Matches**: Returns the first match found

## Integration with GitHub Actions

The script is used in the `get-pr-diff.yml` workflow:

```yaml
- name: Get Jira ticket ID
  id: get-jira-ticket-id
  run: |
    JIRA_PROJECT_KEY="${{ env.JIRA_PROJECT_KEY }}"
    PR_TITLE="${{ github.event.pull_request.title }}"
    BRANCH_NAME="${{ github.event.pull_request.head.ref }}"
    TICKET_ID=$(./scripts/get-jira-ticket-id/get-jira-ticket-id.sh "$JIRA_PROJECT_KEY" "$PR_TITLE" "$BRANCH_NAME")
    echo "ticket=$TICKET_ID" >> $GITHUB_OUTPUT
```

## Environment Variables

- `JIRA_PROJECT_KEY` - Set this in your GitHub repository secrets or environment variables

## Examples

| Input                                             | Output                                  |
| ------------------------------------------------- | --------------------------------------- |
| `"SPREE" "Fix spree-123" ""`                      | `SPREE-123`                             |
| `"SPREE" "" "feature/SPREE-456"`                  | `SPREE-456`                             |
| `"SPREE" "Fix spree-202" "feature/spree-303"`     | `SPREE-202` (PR title takes precedence) |
| `"SPREE" "Fix some bug" "feature/implementation"` | `` (empty - no ticket found)            |
