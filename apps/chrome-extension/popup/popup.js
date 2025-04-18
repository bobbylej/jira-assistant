document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatMessages = document.getElementById("chatMessages");
  const textInput = document.getElementById("textInput");
  const sendButton = document.getElementById("sendButton");
  const recordButton = document.getElementById("recordButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const contextContent = document.getElementById("contextContent");
  const clearChatBtn = document.getElementById("clearChatBtn");

  // State variables
  let isRecording = false;
  let jiraContext = null;

  // Initialize
  init();

  // Event listeners
  sendButton.addEventListener("click", handleSendMessage);
  textInput.addEventListener("keypress", (e) => {
    console.log("keypress", e.key, e.shiftKey);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  recordButton.addEventListener("mousedown", startRecording);
  recordButton.addEventListener("mouseup", stopRecording);
  recordButton.addEventListener("mouseleave", () => {
    if (isRecording) stopRecording();
  });
  clearChatBtn.addEventListener("click", clearChat);

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
      contextContent.textContent = "Not connected to Jira";
      return;
    }

    let contextHtml = '<div class="jira-context">';

    // Show project info
    if (jiraContext.projectKey) {
      contextHtml += `<div class="context-item">Project: <span class="issue-key">${jiraContext.projectKey}</span></div>`;
    }

    // Show issue key if available
    if (jiraContext.issueKey) {
      contextHtml += `<div class="context-item">Issue: <span class="issue-key">${jiraContext.issueKey}</span></div>`;

      // Show summary if available
      if (jiraContext.issueSummary) {
        contextHtml += `<div class="context-item">Summary: ${jiraContext.issueSummary}</div>`;
      }
    }

    // Show board info if available
    if (jiraContext.boardId) {
      contextHtml += `<div class="context-item">Board: <span class="board-id">${jiraContext.boardId}</span>`;
      if (jiraContext.boardType) {
        contextHtml += ` (${jiraContext.boardType})`;
      }
      contextHtml += `</div>`;
    }

    contextHtml += "</div>";

    // Update the context content
    contextContent.innerHTML = contextHtml || "Connected to Jira";

    // Update the chat input placeholder based on context
    if (jiraContext.issueKey && textInput) {
      textInput.placeholder = `Ask about ${jiraContext.issueKey}...`;
    }
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
  async function handleSendMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    textInput.value = "";
    addMessage("user", text);
    showLoading();

    try {
      const chatHistory = await getChatHistory();
      console.log("Chat history:", chatHistory);
      const requestData = {
        text: text,
        context: jiraContext || null,
        chatHistory: chatHistory ? parseChatHistory(chatHistory) : [],
      };

      console.log("Sending request:", requestData);

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
      console.log("Interpret response:", data);

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
          await addMessage(
            "assistant",
            `Review and approve the following actions before executing them.`,
            { actions: actionsToApprove }
          );
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

  // Store actions in memory with their IDs
  const pendingActions = new Map();

  async function addActionToDOM(action) {
    const messageElement = document.createElement("div");
    messageElement.classList.add(
      "message",
      "assistant-message",
      "action-message"
    );

    // Store the action in our map
    pendingActions.set(action.id, action);

    // Create action header with humanized action type
    const actionHeader = document.createElement("div");
    actionHeader.classList.add("action-header");

    // Convert camelCase to Title Case with spaces
    const humanizedActionType = action.actionType
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());

    actionHeader.innerHTML = `<strong>${humanizedActionType}</strong>`;
    messageElement.appendChild(actionHeader);

    // Create parameters section
    const paramsContainer = document.createElement("div");
    paramsContainer.classList.add("action-parameters");

    // Display each parameter in a readable format
    Object.entries(action.parameters).forEach(([key, value]) => {
      const paramRow = document.createElement("div");
      paramRow.classList.add("param-row");

      // Convert camelCase parameter name to readable format
      const readableKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());

      let valueDisplay = "";

      // Format the value based on its type
      if (typeof value === "object" && value !== null) {
        valueDisplay = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
      } else {
        valueDisplay = String(value);
      }

      paramRow.innerHTML = `<span class="param-name">${readableKey}:</span> <span class="param-value">${valueDisplay}</span>`;
      paramsContainer.appendChild(paramRow);
    });

    messageElement.appendChild(paramsContainer);

    // Add approve button
    const approveButton = document.createElement("button");
    approveButton.classList.add("approve-action-btn");
    approveButton.textContent = "Approve & Execute";
    approveButton.setAttribute("data-action-id", action.id);

    // Add button container
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("action-buttons");
    buttonContainer.appendChild(approveButton);
    messageElement.appendChild(buttonContainer);

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return action.id;
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

  function addMessageToDOM(role, content, issues = null) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");

    if (role === "user") {
      messageElement.classList.add("user-message");
    } else {
      messageElement.classList.add("assistant-message");
    }
    messageElement.textContent = content;

    if (issues) {
      const issuesDOM = convertIssuesToDOM(issues);
      if (issuesDOM) {
        messageElement.appendChild(issuesDOM);
      }
    }

    chatMessages.appendChild(messageElement);
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

  async function clearChat() {
    chatMessages.innerHTML = "";
    await chrome.storage.local.remove(["chatHistory", "actionStatuses"]);
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
          await addActionToDOM(action);
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
