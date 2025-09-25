#!/bin/bash

# Test script for get-jira-ticket.sh
# This script tests various scenarios to ensure the Jira ticket extraction works correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local project_key="$2"
    local pr_title="$3"
    local branch_name="$4"
    local expected="$5"
    
    echo -n "Testing: $test_name... "
    
    # Run the script and capture output
    result=$(./get-jira-ticket-id.sh "$project_key" "$pr_title" "$branch_name" 2>&1)
    
    # Extract the ticket ID from the output (look for the pattern PROJECT-NUMBER)
    actual=$(echo "$result" | grep -oE "${project_key}-[0-9]+" | head -1)
    
    # Compare expected vs actual
    if [ "$actual" = "$expected" ]; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Expected: '$expected'"
        echo "  Actual: '$actual'"
        echo "  Full output: $result"
        ((TESTS_FAILED++))
    fi
}

echo "Running tests for get-jira-ticket.sh..."
echo "======================================"

# Test cases
run_test "PR title with lowercase ticket" "SPREE" "Fix bug in spree-123" "" "SPREE-123"
run_test "PR title with uppercase ticket" "SPREE" "Fix bug in SPREE-456" "" "SPREE-456"
run_test "Branch name with ticket" "SPREE" "" "feature/spree-789-implementation" "SPREE-789"
run_test "Branch name with uppercase ticket" "SPREE" "" "feature/SPREE-101-implementation" "SPREE-101"
run_test "PR title takes precedence over branch" "SPREE" "Fix spree-202" "feature/spree-303" "SPREE-202"
run_test "No ticket found" "SPREE" "Fix some bug" "feature/implementation" ""
run_test "Multiple tickets in PR title" "SPREE" "Fix spree-404 and spree-505" "" "SPREE-404"
run_test "Ticket in middle of text" "SPREE" "Update documentation for spree-606" "" "SPREE-606"
run_test "Different project key" "PROJ" "Fix proj-707" "" "PROJ-707"
run_test "Empty PR title, ticket in branch" "SPREE" "" "spree-808" "SPREE-808"
run_test "Empty branch name, ticket in PR" "SPREE" "spree-909" "" "SPREE-909"
run_test "Case insensitive matching" "SPREE" "Fix spree-111" "" "SPREE-111"

echo ""
echo "======================================"
echo "Test Results:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! 😞${NC}"
    exit 1
fi
