document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatMessages = document.getElementById("chatMessages");
  const textInput = document.getElementById("textInput");
  const sendButton = document.getElementById("sendButton");
  const recordButton = document.getElementById("recordButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const contextBubble = document.getElementById("contextBubble");
  const chatPanel = document.getElementById("chatPanel");
  const historyBtn = document.getElementById("historyBtn");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const actionList = document.getElementById("actionList");
  const applyAllBtn = document.getElementById("applyAllBtn");
  const rejectAllBtn = document.getElementById("rejectAllBtn");
  const voiceModeBtn = document.getElementById("voiceModeBtn");
  const textModeBtn = document.getElementById("textModeBtn");
  const voiceInputMode = document.getElementById("voiceInputMode");
  const textInputMode = document.getElementById("textInputMode");
  const clearChatBtn = document.getElementById("clearChatBtn");

  // State variables
  let isRecording = false;
  let jiraContext = null;
  let pendingActions = new Map();

  // Initialize
  init();

  // Event listeners
  sendButton.addEventListener("click", () => handleSendMessage(textInput.value));
  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(textInput.value);
    }
  });
  recordButton.addEventListener("mousedown", startRecording);
  recordButton.addEventListener("mouseup", stopRecording);
  recordButton.addEventListener("mouseleave", () => {
    if (isRecording) stopRecording();
  });
  historyBtn.addEventListener("click", toggleChatHistory);
  closeHistoryBtn.addEventListener("click", toggleChatHistory);
  applyAllBtn.addEventListener("click", handleApplyAll);
  rejectAllBtn.addEventListener("click", handleRejectAll);
  voiceModeBtn.addEventListener("click", () => switchInputMode("voice"));
  textModeBtn.addEventListener("click", () => switchInputMode("text"));
  clearChatBtn.addEventListener("click", clearChat);

  // Input mode switching
  function switchInputMode(mode) {
    if (mode === "voice") {
      voiceModeBtn.classList.add("active");
      textModeBtn.classList.remove("active");
      voiceInputMode.classList.add("active");
      textInputMode.classList.remove("active");
    } else {
      voiceModeBtn.classList.remove("active");
      textModeBtn.classList.add("active");
      voiceInputMode.classList.remove("active");
      textInputMode.classList.add("active");
      textInput.focus();
    }
  }

  // Core functions
  async function init() {
    await loadConfig();
    loadJiraContext();
    loadChatHistory();
    refreshEventListeners();
  }

  async function loadConfig() {
    try {
      const configUrl = chrome.runtime.getURL("config.json");
      const response = await fetch(configUrl);
      const config = await response.json();
      window.API_URL = config.API_URL || "http://localhost:3001/api";
    } catch (error) {
      console.error("Error loading config:", error);
      window.API_URL = "http://localhost:3001/api"; // Fallback URL
    }
  }

  function loadJiraContext() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getJiraContext" },
        (response) => {
          if (response && response.context) {
            jiraContext = response.context;
            updateContextDisplay();
          }
        }
      );
    });
  }

  async function getChatHistory() {
    const result = await chrome.storage.local.get(["chatHistory"]);
    return result.chatHistory ? JSON.parse(result.chatHistory) : [];
  }

  async function loadChatHistory() {
    const chatHistory = await getChatHistory();
    displayMessages(chatHistory);
    console.log("Loaded chat history", chatHistory);

    await updateActionStatusesInDOM();

    addEventListenersForIssueElements();
    addEventListenersForActionButtons();
  }

  async function updateActionStatusesInDOM() {
    // Load action statuses
    const actionStatuses = await loadActionStatuses();
    console.log("Action statuses:", actionStatuses);

    // Apply statuses to action buttons
    Object.entries(actionStatuses).forEach(([actionId, status]) => {
      const button = document.querySelector(
        `.approve-action-btn[data-action-id="${actionId}"]`
      );
      if (button) {
        const actionMessage = button.closest(".action-message");

        if (status.status === "completed") {
          // Apply completed styling
          if (actionMessage) actionMessage.classList.add("action-success");
          button.textContent = "Completed ✓";
          button.classList.add("action-completed");
          button.disabled = true;

          // Add status message if not already present
          if (!button.parentNode.querySelector(".action-status")) {
            const statusMessage = document.createElement("div");
            statusMessage.classList.add("action-status");
            statusMessage.innerHTML = `<span class="status-success">Successfully executed</span>`;
            button.parentNode.appendChild(statusMessage);
          }
        } else if (status.status === "failed") {
          // Apply failed styling
          if (actionMessage) actionMessage.classList.add("action-failure");
          button.textContent = "Try again";
          button.classList.add("action-failed");
          button.disabled = false;

          // Add status message if not already present
          if (!button.parentNode.querySelector(".action-status")) {
            const statusMessage = document.createElement("div");
            statusMessage.classList.add("action-status");
            statusMessage.innerHTML = `<span class="status-error">Error: ${
              status.error || "Unknown error"
            }</span>`;
            button.parentNode.appendChild(statusMessage);
          }
        }
      }
    });
  }

  function updateContextDisplay() {
    if (!jiraContext) {
      contextBubble.style.display = "none";
      return;
    }

    contextBubble.style.display = "block";
    const preview = contextBubble.querySelector(".context-preview");
    const expanded = contextBubble.querySelector(".context-expanded");

    // Update preview
    let previewHtml = "";
    if (jiraContext.projectKey) {
      previewHtml += `<span class="project-key">${jiraContext.projectKey}</span>`;
    }
    if (jiraContext.issueKey) {
      previewHtml += `<span class="issue-key">${jiraContext.issueKey}</span>`;
    }
    preview.innerHTML = previewHtml;

    // Update expanded view
    let expandedHtml = '<div class="context-details">';
    if (jiraContext.projectKey) {
      expandedHtml += `<div class="context-item">Project: <span class="issue-key">${jiraContext.projectKey}</span></div>`;
    }
    if (jiraContext.issueKey) {
      expandedHtml += `<div class="context-item">Issue: <span class="issue-key">${jiraContext.issueKey}</span></div>`;
      if (jiraContext.issueSummary) {
        expandedHtml += `<div class="context-item">Summary: ${jiraContext.issueSummary}</div>`;
      }
    }
    if (jiraContext.boardId) {
      expandedHtml += `<div class="context-item">Board: <span class="board-id">${jiraContext.boardId}</span>`;
      if (jiraContext.boardType) {
        expandedHtml += ` (${jiraContext.boardType})`;
      }
      expandedHtml += `</div>`;
    }
    expandedHtml += "</div>";
    expanded.innerHTML = expandedHtml;
  }

  function parseChatHistory(chatHistory) {
    return chatHistory.map((message) => {
      let content = message.content || "";
      if (message.issues) {
        content += `\nIssues: ${message.issues
          .map(
            (issue) =>
              `[${issue.key}] ${issue.fields?.summary} (Status: ${issue.fields?.status?.name}, Type: ${issue.fields?.issuetype?.name}, Assignee: ${issue.fields?.assignee?.displayName})`
          )
          .join(", ")}`;
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
  }

  // Message handling
  async function handleSendMessage(text) {
    if (!text) return;

    // Clear text input if it was used
    if (textInput.value) {
      textInput.value = "";
    }

    addMessage("user", text);
    showLoading();

    try {
      const chatHistory = await getChatHistory();
      const requestData = {
        text: text,
        context: jiraContext || null,
        chatHistory: chatHistory ? parseChatHistory(chatHistory) : [],
      };

      const response = await fetchWithTimeout(
        `${API_URL}/interpret`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        },
        30000
      );

      const data = await response.json();

      if (data.action) {
        if (data.action.parameters.actions) {
          const actionsToExecute = data.action.parameters.actions.filter(
            (action) => !action.approveRequired
          );
          actionsToExecute.forEach(async (action) => {
            await handleAction(action);
          });

          const actionsToApprove = data.action.parameters.actions
            .filter((action) => action.approveRequired)
            .map((action) => ({
              ...action,
              id: generateActionId(),
            }));
          
          actionsToApprove.forEach(action => addActionToPanel(action));
        } else {
          await handleAction(data.action);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      addMessage("assistant", `Error: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // Add a utility function to generate unique IDs
  function generateActionId() {
    return (
      "action_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  function toggleChatHistory() {
    console.log("toggleChatHistory", chatPanel.classList);
    
    if (chatPanel.classList.contains("visible")) {
      chatPanel.classList.remove("visible");
    } else {
      chatPanel.classList.add("visible");
    }
  }

  function getActionIcon(actionType) {
    switch (actionType) {
      case 'createIssue': return '📝';
      case 'updateIssue': return '✏️';
      case 'deleteIssue': return '🗑️';
      case 'commentIssue': return '💬';
      default: return '⚡';
    }
  }

  function getActionSummary(action) {
    // Show action type and key info (e.g., issue key or summary)
    let summary = action.actionType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    if (action.parameters && action.parameters.issueKey) {
      summary += `: ${action.parameters.issueKey}`;
    } else if (action.parameters && action.parameters.summary) {
      summary += `: ${action.parameters.summary}`;
    }
    return summary;
  }

  let expandedActionId = null;

  function addActionToPanel(action) {
    // Remove existing row if present (for re-render)
    const existing = actionList.querySelector(`[data-action-id="${action.id}"]`);
    if (existing) existing.remove();

    const row = document.createElement('div');
    row.className = 'action-row';
    row.dataset.actionId = action.id;
    row.dataset.status = 'pending';

    const main = document.createElement('div');
    main.className = 'action-main';
    row.appendChild(main);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'action-icon';
    icon.textContent = getActionIcon(action.actionType);
    main.appendChild(icon);

    // Summary
    const summary = document.createElement('span');
    summary.className = 'action-summary';
    summary.textContent = getActionSummary(action);
    main.appendChild(summary);

    // Status dot
    const statusDot = document.createElement('span');
    statusDot.className = 'action-status-dot';
    main.appendChild(statusDot);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'action-controls';
    // Approve (check)
    const approveBtn = document.createElement('button');
    approveBtn.className = 'action-btn-icon';
    approveBtn.title = 'Approve & Execute';
    approveBtn.innerHTML = '✔️';
    approveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAction(action, action.id);
    });
    // Reject (cross)
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'action-btn-icon';
    rejectBtn.title = 'Reject';
    rejectBtn.innerHTML = '✖️';
    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAction(action.id);
    });
    controls.appendChild(approveBtn);
    controls.appendChild(rejectBtn);
    main.appendChild(controls);

    // Expand/collapse details
    row.addEventListener('click', () => {
      if (expandedActionId === action.id) {
        expandedActionId = null;
        renderActionDetails(null);
      } else {
        expandedActionId = action.id;
        renderActionDetails(action);
      }
      // Collapse/expand all rows
      Array.from(actionList.children).forEach(child => {
        if (child.dataset.actionId !== expandedActionId) {
          const details = child.querySelector('.action-details-expanded');
          if (details) details.remove();
          child.classList.remove('expanded');
        }
      });
    });

    actionList.appendChild(row);
    // If this is the expanded action, show details
    if (expandedActionId === action.id) {
      renderActionDetails(action);
    }
    pendingActions.set(action.id, action);
  }

  function renderActionDetails(action) {
    // Remove all details panels
    Array.from(actionList.children).forEach(child => {
      const details = child.querySelector('.action-details-expanded');
      if (details) details.remove();
      child.classList.remove('expanded');
    });
    if (!action) return;
    const row = actionList.querySelector(`[data-action-id="${action.id}"]`);
    if (!row) return;
    row.classList.add('expanded');

    // Create expanded details container
    const details = document.createElement('div');
    details.className = 'action-details-expanded';

    // Top row: icon, status, controls
    const topRow = document.createElement('div');
    topRow.className = 'action-details-toprow';

    // Icon
    const icon = document.createElement('span');
    icon.className = 'action-icon';
    icon.textContent = getActionIcon(action.actionType);
    topRow.appendChild(icon);

    // Status dot
    const statusDot = document.createElement('span');
    statusDot.className = 'action-status-dot';
    topRow.appendChild(statusDot);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'action-controls';
    // Approve (check)
    const approveBtn = document.createElement('button');
    approveBtn.className = 'action-btn-icon';
    approveBtn.title = 'Approve & Execute';
    approveBtn.innerHTML = '✔️';
    approveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAction(action, action.id);
    });
    // Reject (cross)
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'action-btn-icon';
    rejectBtn.title = 'Reject';
    rejectBtn.innerHTML = '✖️';
    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAction(action.id);
    });
    controls.appendChild(approveBtn);
    controls.appendChild(rejectBtn);
    topRow.appendChild(controls);

    details.appendChild(topRow);

    // Details table
    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'action-details';
    let html = '<table class="action-details-table">';
    for (const [key, value] of Object.entries(action.parameters)) {
      html += `<tr><td>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</td><td>${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</td></tr>`;
    }
    html += '</table>';
    detailsPanel.innerHTML = html;
    details.appendChild(detailsPanel);

    row.appendChild(details);
  }

  function removeAction(actionId) {
    const actionElement = actionList.querySelector(`[data-action-id="${actionId}"]`);
    if (actionElement) {
      actionElement.remove();
      pendingActions.delete(actionId);
      if (expandedActionId === actionId) expandedActionId = null;
    }
  }

  async function handleApplyAll() {
    for (const [actionId, action] of pendingActions) {
      await handleAction(action);
    }
  }

  function handleRejectAll() {
    pendingActions.clear();
    actionList.innerHTML = "";
  }

  function addMessageToDOM(role, content, issues = null) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");

    // Add role-specific class and label
    let roleLabel = '';
    if (role === "user") {
      messageElement.classList.add("user-message");
      roleLabel = '<span class="role-label">You</span>';
    } else {
      messageElement.classList.add("assistant-message");
      roleLabel = '<span class="role-label">Agent</span>';
    }

    messageElement.innerHTML = `${roleLabel}${content}`;

    if (issues && issues.length > 0) {
      const issuesDOM = convertIssuesToDOM(issues);
      if (issuesDOM) {
        messageElement.appendChild(issuesDOM);
      }
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function saveMessageToStorage(role, content, data = {}) {
    try {
      const chatHistory = await getChatHistory();
      console.log(
        "Saving message to storage:",
        { role, content, data },
        chatHistory
      );

      // Create a new message object
      const newMessage = { role, content, data };

      // Add to chat history
      chatHistory.push(newMessage);

      // Limit history size
      if (chatHistory.length > 50) {
        chatHistory = chatHistory.slice(chatHistory.length - 50);
      }

      // Save to storage
      await chrome.storage.local.set({
        chatHistory: JSON.stringify(chatHistory),
      });
    } catch (error) {
      console.error("Error saving message to storage:", error);
    }
  }

  async function deleteIssue(issueKey) {
    if (!confirm(`Are you sure you want to delete issue ${issueKey}?`)) {
      return;
    }

    showLoading();

    try {
      // Include Jira context in the delete request
      const response = await fetchWithTimeout(
        `${API_URL}/jira/issue/${issueKey}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              jira: jiraContext || null,
            },
          }),
        },
        30000
      );

      const data = await response.json();

      if (data.success) {
        addMessage("assistant", data.message);
      } else {
        addMessage("assistant", `Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
      addMessage("assistant", `Error deleting issue: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // Utility functions
  function base64ToBlob(base64Data) {
    const byteCharacters = atob(base64Data.split(",")[1]);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: "audio/wav" });
  }

  function fetchWithTimeout(url, options, timeout = 10000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
      ),
    ]);
  }

  function openIssueInCurrentTab(issueKey) {
    // Get the base URL from the Jira context if available
    let baseUrl = "";
    if (jiraContext && jiraContext.url) {
      // Extract the base URL (e.g., https://your-domain.atlassian.net)
      const urlParts = jiraContext.url.match(/^(https?:\/\/[^\/]+)/);
      if (urlParts && urlParts[1]) {
        baseUrl = urlParts[1];
      }
    }

    // If we couldn't determine the base URL, we'll use a generic Jira URL format
    // The user's Jira instance will redirect appropriately
    const issueUrl = baseUrl
      ? `${baseUrl}/browse/${issueKey}`
      : `https://jira.atlassian.com/browse/${issueKey}`;

    // Open the issue in the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: issueUrl });
    });
  }

  function addEventListenersForIssueElements() {
    // First, remove existing event listeners by cloning and replacing elements
    chatMessages.querySelectorAll(".delete-issue-btn").forEach((button) => {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
    });

    chatMessages.querySelectorAll(".issue-key-link").forEach((link) => {
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
    });

    // Now add fresh event listeners
    chatMessages.querySelectorAll(".delete-issue-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const issueKey = button.getAttribute("data-issue-key");
        deleteIssue(issueKey);
      });
    });

    chatMessages.querySelectorAll(".issue-key-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const issueKey = link.getAttribute("data-issue-key");
        openIssueInCurrentTab(issueKey);
      });
    });
  }

  function addEventListenersForActionButtons() {
    chatMessages.querySelectorAll(".approve-action-btn").forEach((button) => {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", function () {
        const actionId = this.getAttribute("data-action-id");
        const action = pendingActions.get(actionId);

        if (!action) {
          console.error("Action not found:", actionId);
          return;
        }

        // Disable the button to prevent multiple clicks
        this.disabled = true;
        this.textContent = "Executing...";

        // Execute the action
        handleAction(action, actionId);
      });
    });
  }

  async function handleAction(action, actionId) {
    // Find the button using the action ID
    const actionButton = document.querySelector(
      `.approve-action-btn[data-action-id="${actionId}"]`
    );

    switch (action.actionType) {
      case "message":
      case "error":
        addMessage("assistant", action.parameters.message);
        break;

      default:
        try {
          // Pass both structured and text Jira context with the action
          const executeResponse = await fetchWithTimeout(
            `${API_URL}/execute`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action,
                context: jiraContext || null,
              }),
            },
            30000
          );

          const executeData = await executeResponse.json();

          console.log("executeData:", executeData);

          if (!executeData.success) {
            throw new Error(executeData.error);
          }

          // Save the success status to storage
          await saveActionStatus(actionId, {
            status: "completed",
            timestamp: Date.now(),
          });

          // Remove the action from pending actions
          pendingActions.delete(actionId);

          addMessage(
            "assistant",
            executeData.message,
            executeData.data
          );
        } catch (error) {
          console.error("Error executing action:", error);

          // Save the failure status to storage
          await saveActionStatus(actionId, {
            status: "failed",
            error: error.message,
            timestamp: Date.now(),
          });

          addMessage("assistant", `Error executing action: ${error.message}`);
        } finally {
          if (actionButton) {
            await updateActionStatusesInDOM();
          }
        }
    }
  }

  function refreshEventListeners() {
    // Call this function whenever you need to refresh all event listeners
    addEventListenersForIssueElements();

    // Also refresh action approval buttons
    addEventListenersForActionButtons();
  }

  // Recording functions
  async function startRecording() {
    if (isRecording) return;

    try {
      await chrome.tabs.query(
        { active: true, currentWindow: true },
        async (tabs) => {
          const activeTab = tabs[0];

          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              function: requestMicrophoneAccess,
            },
            (results) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error executing script:",
                  chrome.runtime.lastError
                );
                addMessage(
                  "assistant",
                  "Cannot access microphone on this page. Try on a Jira page."
                );
                return;
              }

              if (results && results[0] && results[0].result === true) {
                recordButton.classList.add("recording");
                isRecording = true;
                addMessage(
                  "assistant",
                  "Recording in progress... Speak now and click again to stop."
                );
              } else {
                addMessage("assistant", "Microphone access was denied.");
              }
            }
          );
        }
      );
    } catch (error) {
      console.error("Error starting recording:", error);
      addMessage("assistant", `Error starting recording: ${error.message}`);
    }
  }

  async function stopRecording() {
    if (!isRecording) return;

    try {
      await chrome.tabs.query(
        { active: true, currentWindow: true },
        async (tabs) => {
          const activeTab = tabs[0];

          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              function: stopRecordingInTab,
            },
            async (results) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error executing script:",
                  chrome.runtime.lastError
                );
                addMessage("assistant", "Error stopping recording.");
                return;
              }

              if (results && results[0] && results[0].result) {
                const audioBase64 = results[0].result;
                const audioBlob = base64ToBlob(audioBase64);
                await processAudio(audioBlob);
              }
            }
          );
        }
      );

      recordButton.classList.remove("recording");
      isRecording = false;
    } catch (error) {
      console.error("Error stopping recording:", error);
      addMessage("assistant", `Error stopping recording: ${error.message}`);
    }
  }

  async function processAudio(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) {
      console.error("Empty audio blob");
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    showLoading();

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/transcribe`,
        {
          method: "POST",
          body: formData,
          mode: "cors",
          credentials: "omit",
        },
        30000
      );

      const data = await response.json();

      if (data.text) {
        // Add user message to chat
        addMessage("user", data.text);

        // Process the transcribed text with context
        const interpretResponse = await fetchWithTimeout(
          `${API_URL}/interpret`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: data.text,
              context: jiraContext || null,
            }),
          },
          30000
        );

        const interpretData = await interpretResponse.json();

        if (interpretData.action) {
          await handleAction(interpretData.action);
        }
      } else {
        addMessage(
          "assistant",
          "Could not transcribe audio. Please try again."
        );
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      addMessage("assistant", `Error transcribing audio: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // UI functions
  function showLoading() {
    loadingIndicator.classList.add("visible");
    textInput.disabled = true;
    sendButton.disabled = true;
    recordButton.disabled = true;
  }

  function hideLoading() {
    loadingIndicator.classList.remove("visible");
    textInput.disabled = false;
    sendButton.disabled = false;
    recordButton.disabled = false;
  }

  function displayMessages(messages) {
    // Clear existing messages first
    chatMessages.innerHTML = "";

    // Then add each message from history
    messages.forEach((message) => {
      addMessageToChat(message.role, message.content, message.data);
    });

    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addMessageToChat(role, content, data = {}) {
    if (role === "assistant" && data && data.actions) {
      // Add each action that requires approval
      data.actions.forEach(async (action) => {
        if (action.approveRequired) {
          await addActionToPanel(action);
        }
      });
    } else {
      const issues = [
        ...(data?.issues || []),
        ...(data?.issue ? [data.issue] : []),
      ];

      addMessageToDOM(role, content, issues);
    }
  }

  async function addMessage(role, content, data = {}) {
    console.log(
      `Adding message - Role: ${role}, Content: ${content?.substring(0, 50)}...`
    );

    // Check if data contains actions that need approval
    addMessageToChat(role, content, data);

    addEventListenersForIssueElements();
    addEventListenersForActionButtons();
    // Save to storage
    await saveMessageToStorage(role, content, data);
  }

  // Add a function to save action status to storage
  async function saveActionStatus(actionId, status) {
    try {
      // Get existing action statuses
      const result = await chrome.storage.local.get(["actionStatuses"]);
      const actionStatuses = result.actionStatuses || {};

      // Update the status for this action
      actionStatuses[actionId] = status;

      // Save back to storage
      await chrome.storage.local.set({ actionStatuses });

      console.log(`Saved action status: ${actionId} -> ${status}`);
    } catch (error) {
      console.error("Error saving action status:", error);
    }
  }

  // Add a function to load action statuses
  async function loadActionStatuses() {
    try {
      const result = await chrome.storage.local.get(["actionStatuses"]);
      return result.actionStatuses || {};
    } catch (error) {
      console.error("Error loading action statuses:", error);
      return {};
    }
  }

  async function clearChat() {
    if (confirm("Are you sure you want to clear the chat history?")) {
      chatMessages.innerHTML = "";
      await chrome.storage.local.remove(["chatHistory", "actionStatuses"]);
      addMessage("assistant", "Chat history has been cleared.");
    }
  }
});

// Functions to be injected into the active tab
function requestMicrophoneAccess() {
  return new Promise(async (resolve) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      window.recordingStream = stream;

      const mediaRecorder = new MediaRecorder(stream);
      window.mediaRecorder = mediaRecorder;
      window.audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        window.audioChunks.push(event.data);
      });

      mediaRecorder.start();
      chrome.runtime.sendMessage({ action: "recordingStarted" });

      resolve(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      resolve(false);
    }
  });
}

function stopRecordingInTab() {
  return new Promise((resolve) => {
    if (!window.mediaRecorder || !window.recordingStream) {
      resolve(null);
      return;
    }

    window.mediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(window.audioChunks, { type: "audio/wav" });

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        window.recordingStream.getTracks().forEach((track) => track.stop());
        window.mediaRecorder = null;
        window.recordingStream = null;
        window.audioChunks = [];

        resolve(reader.result);
      };
    });

    window.mediaRecorder.stop();
  });
}

/**
 * Converts the Jira context object into a descriptive text format
 * that's easier for the AI engine to understand and utilize
 */
function convertJiraContextToText(context) {
  if (!context) return null;

  let contextText = "# Current Jira Context\n";

  // Add project information
  if (context.projectKey) {
    contextText += `## Project: ${context.projectKey}\n`;
  }

  // Add issue information if available
  if (context.issueKey) {
    contextText += `## Issue: ${context.issueKey}\n`;

    if (context.issueSummary) {
      contextText += `Summary: "${context.issueSummary}"\n`;
    }

    if (context.issueStatus) {
      contextText += `Status: ${context.issueStatus}\n`;
    }

    if (context.issueType) {
      contextText += `Type: ${context.issueType}\n`;
    }

    if (context.assignee) {
      contextText += `Assignee: ${context.assignee}\n`;
    }

    // Add description if available
    if (context.issueDescription) {
      contextText += `\nDescription:\n${context.issueDescription}\n`;
    }

    // Add comments if available
    if (context.comments && context.comments.length > 0) {
      contextText += `\nThis issue has ${context.comments.length} comments.\n`;

      // Optionally include recent comments
      if (context.comments.length <= 3) {
        contextText += "Recent comments:\n";
        context.comments.forEach((comment, index) => {
          contextText += `- Comment ${index + 1}: ${comment.text.substring(
            0,
            100
          )}${comment.text.length > 100 ? "..." : ""}\n`;
        });
      } else {
        contextText +=
          "Most recent comment: " +
          context.comments[context.comments.length - 1].text.substring(0, 100) +
          (context.comments[context.comments.length - 1].text.length > 100
            ? "..."
            : "") +
          "\n";
      }
    }
  }

  // Add board information if available
  if (context.boardId) {
    contextText += `\n## Board Information\n`;
    contextText += `Board ID: ${context.boardId}\n`;

    if (context.boardType) {
      contextText += `Board Type: ${context.boardType}\n`;
    }
  }

  // Add URL information
  if (context.url) {
    contextText += `\n## URL\n${context.url}\n`;
  }

  // Add capabilities section to guide the AI
  contextText += "\n## Available Actions\n";
  contextText += "- Create new issues in the current project\n";
  contextText += "- Update issue details (status, assignee, etc.)\n";
  contextText += "- Add comments to issues\n";
  contextText += "- Search for issues by key or criteria\n";
  contextText += "- Provide information about Jira concepts\n";

  return contextText.trim();
}

function convertIssuesToDOM(issues) {
  const issuesElement = document.createElement("div");
  issuesElement.classList.add("issues");
  issues
    .map((issue) => convertIssueToDOM(issue))
    .forEach((issue) => issuesElement.appendChild(issue));
  return issuesElement;
}

function convertIssueToDOM(issue) {
  const issueElement = document.createElement("div");
  issueElement.classList.add("issue");
  let innerHTML = `<div class="issue-header">`;
  innerHTML += `<a href="#" class="issue-key-link" data-issue-key="${issue.key}">${issue.key}</a>`;
  innerHTML += `<button class="delete-issue-btn" data-issue-key="${issue.key}">Delete</button>`;
  innerHTML += `</div>`;

  if (issue.fields?.summary)
    innerHTML += `<span class="issue-summary">${issue.fields?.summary}</span>`;
  if (issue.fields?.status)
    innerHTML += `<span class="issue-status">Status: ${issue.fields?.status?.name}</span>`;
  if (issue.fields?.issuetype)
    innerHTML += `<span class="issue-type">Type: ${issue.fields?.issuetype?.name}</span>`;
  if (issue.fields?.assignee)
    innerHTML += `<span class="issue-assignee">Assignee: ${issue.fields?.assignee?.displayName}</span>`;
  issueElement.innerHTML = innerHTML;

  return issueElement;
}
