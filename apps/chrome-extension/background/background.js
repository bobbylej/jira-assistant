// Background script for the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('DoIt Jira Assistant extension installed');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    chrome.action.setBadgeText({ text: request.text });
    chrome.action.setBadgeBackgroundColor({ color: request.color || "#0052cc" });
  }
  return true;
}); 