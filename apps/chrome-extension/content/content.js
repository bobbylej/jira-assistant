// Content script that runs on Jira pages
(function() {
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getJiraContext") {
      sendResponse({ context: extractJiraContext() });
    }
    return true;
  });
  
  // Extract Jira context from the current page
  function extractJiraContext() {
    const context = {
      url: window.location.href,
      domain: window.location.hostname
    };
    
    // Extract project key from URL
    const projectKeyMatch = window.location.pathname.match(/\/projects\/([A-Z0-9]+)/i);
    if (projectKeyMatch) {
      context.projectKey = projectKeyMatch[1];
    }
    
    // Extract issue key from URL - direct issue view
    const issueKeyMatch = window.location.pathname.match(/\/browse\/([A-Z]+-[0-9]+)/i);
    if (issueKeyMatch) {
      context.issueKey = issueKeyMatch[1];
      extractIssueDetails(context);
    }
    
    // Extract issue key from URL params - for backlog/board view with selected issue
    const urlParams = new URLSearchParams(window.location.search);
    const selectedIssue = urlParams.get('selectedIssue');
    if (selectedIssue && selectedIssue.match(/[A-Z]+-[0-9]+/i)) {
      context.issueKey = selectedIssue;
      // Try to extract issue details from the modal/panel
      extractIssueDetailsFromModal(context);
    }
    
    // Extract board information
    const boardMatch = window.location.pathname.match(/\/jira\/software\/projects\/([A-Z0-9]+)\/boards\/([0-9]+)/i);
    if (boardMatch) {
      context.projectKey = boardMatch[1];
      context.boardId = boardMatch[2];
      context.boardType = document.querySelector('[data-test-id="software-board.board-header.backlog-button"]') 
        ? 'scrum' : 'kanban';
    }
    
    return context;
  }
  
  function extractIssueDetails(context) {
    // Try to get issue summary
    const summaryElement = document.querySelector('[data-test-id="issue.views.issue-base.foundation.summary.heading"]');
    if (summaryElement) {
      context.issueSummary = summaryElement.textContent.trim();
    }
    
    // Try to get issue status
    const statusElement = document.querySelector('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]');
    if (statusElement) {
      context.issueStatus = statusElement.textContent.trim();
    }
    
    // Try to get issue type
    const issueTypeElement = document.querySelector('[data-test-id="issue.views.issue-base.foundation.issue-type.issue-type-field-wrapper"]');
    if (issueTypeElement) {
      context.issueType = issueTypeElement.textContent.trim();
    }
  }
  
  // Extract issue details from modal when an issue is selected in backlog/board view
  function extractIssueDetailsFromModal(context) {
    // Try to get issue summary from the modal
    const modalSummarySelectors = [
      '[data-test-id="issue-details-modal"] h1',
      '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
      '.issue-details-modal h1',
      'div[role="dialog"] h1'
    ];
    
    for (const selector of modalSummarySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        context.issueSummary = element.textContent.trim();
        break;
      }
    }
    
    // Try to get issue status from the modal
    const statusSelectors = [
      '[data-test-id="issue-details-modal"] [data-test-id="status-field"]',
      '[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]',
      'div[role="dialog"] [data-test-id*="status"]'
    ];
    
    for (const selector of statusSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        context.issueStatus = element.textContent.trim();
        break;
      }
    }
    
    // Try to get issue type from the modal
    const typeSelectors = [
      '[data-test-id="issue-details-modal"] [data-test-id="issue-type-field"]',
      '[data-test-id="issue.views.issue-base.foundation.issue-type.issue-type-field-wrapper"]',
      'div[role="dialog"] [data-test-id*="issue-type"]'
    ];
    
    for (const selector of typeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        context.issueType = element.textContent.trim();
        break;
      }
    }
  }
})(); 