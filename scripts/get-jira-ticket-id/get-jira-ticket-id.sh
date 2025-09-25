#!/bin/bash

# Script to extract Jira ticket ID from PR title or branch name
# Usage: ./get-jira-ticket.sh <project_key> <pr_title> <branch_name>

set -e

# Function to display usage
usage() {
    echo "Usage: $0 <project_key> <pr_title> <branch_name>"
    echo "Example: $0 SPREE 'Fix bug in spree-123' 'feature/SPREE-456-implementation'"
    exit 1
}

# Check if required arguments are provided
if [ $# -ne 3 ]; then
    usage
fi

JIRA_PROJECT_KEY="$1"
PR_TITLE="$2"
BRANCH_NAME="$3"

# Validate project key
if [ -z "$JIRA_PROJECT_KEY" ]; then
    echo "Error: Jira project key is required"
    exit 1
fi

# Create regex pattern for Jira ticket (case insensitive)
# Pattern: SPREE-123 (where SPREE is the project key)
REGEX_PATTERN="(?i)${JIRA_PROJECT_KEY}-[0-9]+"

# Search for Jira ticket in PR title first, then in branch name
TICKET_ID=""

if [ -n "$PR_TITLE" ]; then
    TICKET_ID=$(echo "$PR_TITLE" | grep -oE "$REGEX_PATTERN" | head -1)
fi

# If not found in PR title, search in branch name
if [ -z "$TICKET_ID" ] && [ -n "$BRANCH_NAME" ]; then
    TICKET_ID=$(echo "$BRANCH_NAME" | grep -oE "$REGEX_PATTERN" | head -1)
fi

# Convert to uppercase for consistency
if [ -n "$TICKET_ID" ]; then
    TICKET_ID=$(echo "$TICKET_ID" | tr '[:lower:]' '[:upper:]')
    echo "Found Jira ticket: $TICKET_ID"
    echo "$TICKET_ID"
else
    echo "No Jira ticket found in PR title or branch name"
    echo ""
fi
