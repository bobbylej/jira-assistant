document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatMessages = document.getElementById('chatMessages');
  const textInput = document.getElementById('textInput');
  const sendButton = document.getElementById('sendButton');
  const recordButton = document.getElementById('recordButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const contextContent = document.getElementById('contextContent');
  const clearChatBtn = document.getElementById('clearChatBtn');
  
  // State variables
  let isRecording = false;
  let jiraContext = null;
  
  // Configuration
  const API_URL = 'http://localhost:3000/api';
  
  // Initialize
  init();
  
  // Event listeners
  sendButton.addEventListener('click', handleSendMessage);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  recordButton.addEventListener('mousedown', startRecording);
  recordButton.addEventListener('mouseup', stopRecording);
  recordButton.addEventListener('mouseleave', () => {
    if (isRecording) stopRecording();
  });
  clearChatBtn.addEventListener('click', clearChat);
  
  // Core functions
  async function init() {
    loadJiraContext();
    loadChatHistory();
  }
  
  function loadJiraContext() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getJiraContext"}, (response) => {
        if (response && response.context) {
          jiraContext = response.context;
          updateContextDisplay();
        }
      });
    });
  }
  
  function loadChatHistory() {
    chrome.storage.local.get(['chatHistory'], (result) => {
      if (result.chatHistory) {
        displayMessages(JSON.parse(result.chatHistory));
      }
    });
  }
  
  function updateContextDisplay() {
    if (!jiraContext) {
      contextContent.textContent = 'Not connected to Jira';
      return;
    }
    
    let contextHtml = '';
    
    if (jiraContext.projectKey) {
      contextHtml += `<div>Project: <span class="issue-key">${jiraContext.projectKey}</span></div>`;
    }
    
    if (jiraContext.issueKey) {
      contextHtml += `<div>Current Issue: <span class="issue-key">${jiraContext.issueKey}</span></div>`;
    }
    
    if (jiraContext.issueSummary) {
      contextHtml += `<div>Summary: ${jiraContext.issueSummary}</div>`;
    }
    
    contextContent.innerHTML = contextHtml || 'Connected to Jira';
  }
  
  // Message handling
  async function handleSendMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    
    textInput.value = '';
    addMessage('user', text);
    showLoading();
    
    try {
      const requestData = { text };
      if (jiraContext) requestData.context = jiraContext;
      
      const response = await fetchWithTimeout(`${API_URL}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      }, 30000);
      
      const data = await response.json();
      
      if (data.action) {
        await handleAction(data.action);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('assistant', `Error: ${error.message}`);
    } finally {
      hideLoading();
    }
  }
  
  async function handleAction(action) {
    switch (action.actionType) {
      case 'message':
      case 'error':
        addMessage('assistant', action.parameters.message);
        break;
        
      default:
        try {
          const executeResponse = await fetchWithTimeout(`${API_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, context: jiraContext })
          }, 30000);
          
          const executeData = await executeResponse.json();
          
          if (executeData.result) {
            addMessage('assistant', executeData.result.message);
          }
        } catch (error) {
          console.error('Error executing action:', error);
          addMessage('assistant', `Error executing action: ${error.message}`);
        }
    }
  }
  
  // Recording functions
  async function startRecording() {
    if (isRecording) return;
    
    try {
      await chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        const activeTab = tabs[0];
        
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          function: requestMicrophoneAccess
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error executing script:', chrome.runtime.lastError);
            addMessage('assistant', 'Cannot access microphone on this page. Try on a Jira page.');
            return;
          }
          
          if (results && results[0] && results[0].result === true) {
            recordButton.classList.add('recording');
            isRecording = true;
            addMessage('assistant', 'Recording in progress... Speak now and click again to stop.');
          } else {
            addMessage('assistant', 'Microphone access was denied.');
          }
        });
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      addMessage('assistant', `Error starting recording: ${error.message}`);
    }
  }
  
  async function stopRecording() {
    if (!isRecording) return;
    
    try {
      await chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        const activeTab = tabs[0];
        
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          function: stopRecordingInTab
        }, async (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error executing script:', chrome.runtime.lastError);
            addMessage('assistant', 'Error stopping recording.');
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const audioBase64 = results[0].result;
            const audioBlob = base64ToBlob(audioBase64);
            await processAudio(audioBlob);
          }
        });
      });
      
      recordButton.classList.remove('recording');
      isRecording = false;
    } catch (error) {
      console.error('Error stopping recording:', error);
      addMessage('assistant', `Error stopping recording: ${error.message}`);
    }
  }
  
  async function processAudio(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) {
      console.error('Empty audio blob');
      return;
    }
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    
    showLoading();
    
    try {
      const response = await fetchWithTimeout(`${API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit'
      }, 30000);
      
      const data = await response.json();
      
      if (data.text) {
        textInput.value = data.text;
        handleSendMessage();
      } else {
        addMessage('assistant', 'Could not transcribe audio. Please try again.');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      addMessage('assistant', `Error transcribing audio: ${error.message}`);
    } finally {
      hideLoading();
    }
  }
  
  // UI functions
  function showLoading() {
    loadingIndicator.classList.add('visible');
    textInput.disabled = true;
    sendButton.disabled = true;
    recordButton.disabled = true;
  }
  
  function hideLoading() {
    loadingIndicator.classList.remove('visible');
    textInput.disabled = false;
    sendButton.disabled = false;
    recordButton.disabled = false;
  }
  
  function displayMessages(messages) {
    chatMessages.innerHTML = '';
    messages.forEach(message => addMessageToDOM(message.role, message.content));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addMessage(role, content) {
    addMessageToDOM(role, content);
    saveMessageToStorage(role, content);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addMessageToDOM(role, content) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (role === 'user') {
      messageElement.classList.add('user-message');
      messageElement.textContent = content;
    } else {
      messageElement.classList.add('assistant-message');
      
      if (content.includes('Issue Key:')) {
        let formattedContent = content
          .replace(/\n/g, '<br>')
          .replace(/Issue Key: ([\w-]+)/g, (match, issueKey) => {
            return `<span class="issue-key">${issueKey}</span> <button class="delete-issue-btn" data-issue-key="${issueKey}">Delete</button>`;
          });
        
        messageElement.innerHTML = formattedContent;
        
        messageElement.querySelectorAll('.delete-issue-btn').forEach(button => {
          button.addEventListener('click', () => {
            const issueKey = button.getAttribute('data-issue-key');
            deleteIssue(issueKey);
          });
        });
      } else {
        messageElement.textContent = content;
      }
    }
    
    chatMessages.appendChild(messageElement);
  }
  
  function saveMessageToStorage(role, content) {
    chrome.storage.local.get(['chatHistory'], (result) => {
      let messages = result.chatHistory ? JSON.parse(result.chatHistory) : [];
      messages.push({ role, content });
      
      if (messages.length > 50) {
        messages = messages.slice(messages.length - 50);
      }
      
      chrome.storage.local.set({ chatHistory: JSON.stringify(messages) });
    });
  }
  
  async function deleteIssue(issueKey) {
    if (!confirm(`Are you sure you want to delete issue ${issueKey}?`)) {
      return;
    }
    
    showLoading();
    
    try {
      const response = await fetchWithTimeout(`${API_URL}/jira/issue/${issueKey}`, {
        method: 'DELETE'
      }, 30000);
      
      const data = await response.json();
      
      if (data.success) {
        addMessage('assistant', data.message);
      } else {
        addMessage('assistant', `Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
      addMessage('assistant', `Error deleting issue: ${error.message}`);
    } finally {
      hideLoading();
    }
  }
  
  function clearChat() {
    chatMessages.innerHTML = '';
    chrome.storage.local.remove(['chatHistory']);
  }
  
  // Utility functions
  function base64ToBlob(base64Data) {
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'audio/wav' });
  }
  
  function fetchWithTimeout(url, options, timeout = 10000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), timeout)
      )
    ]);
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
      
      mediaRecorder.addEventListener('dataavailable', (event) => {
        window.audioChunks.push(event.data);
      });
      
      mediaRecorder.start();
      chrome.runtime.sendMessage({ action: 'recordingStarted' });
      
      resolve(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
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
    
    window.mediaRecorder.addEventListener('stop', () => {
      const audioBlob = new Blob(window.audioChunks, { type: 'audio/wav' });
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        window.recordingStream.getTracks().forEach(track => track.stop());
        window.mediaRecorder = null;
        window.recordingStream = null;
        window.audioChunks = [];
        
        resolve(reader.result);
      };
    });
    
    window.mediaRecorder.stop();
  });
} 