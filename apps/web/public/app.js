document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatMessages');
  const textInput = document.getElementById('textInput');
  const sendButton = document.getElementById('sendButton');
  const recordButton = document.getElementById('recordButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  let isRecording = false;
  let mediaRecorder;
  let audioChunks = [];
  
  console.log('App initialized');
  
  // Initialize chat
  initializeChat();
  
  // Event listeners
  sendButton.addEventListener('click', handleSendMessage);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
  
  console.log('Adding recording event listeners');
  recordButton.addEventListener('mousedown', () => {
    console.log('Record button pressed');
    startRecording();
  });
  
  recordButton.addEventListener('mouseup', () => {
    console.log('Record button released');
    stopRecording();
  });
  
  recordButton.addEventListener('mouseleave', () => {
    console.log('Mouse left record button');
    if (isRecording) {
      stopRecording();
    }
  });
  
  // Touch events for mobile
  recordButton.addEventListener('touchstart', (e) => {
    console.log('Touch started on record button');
    e.preventDefault();
    startRecording();
  });
  
  recordButton.addEventListener('touchend', (e) => {
    console.log('Touch ended on record button');
    e.preventDefault();
    stopRecording();
  });
  
  // Add this near the top of your event listeners
  document.getElementById('clearChatBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/chats/clear', {
        method: 'POST'
      });
      
      if (response.ok) {
        chatMessages.innerHTML = '';
        console.log('Chat cleared');
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  });
  
  // Functions
  async function initializeChat() {
    try {
      const response = await fetch('/api/chats/active');
      const data = await response.json();
      
      if (data.chat && data.chat.messages) {
        displayMessages(data.chat.messages);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }
  
  // Functions to show/hide loading indicator
  function showLoading() {
    loadingIndicator.classList.add('visible');
    // Disable input while processing
    textInput.disabled = true;
    sendButton.disabled = true;
    recordButton.disabled = true;
  }
  
  function hideLoading() {
    loadingIndicator.classList.remove('visible');
    // Re-enable input
    textInput.disabled = false;
    sendButton.disabled = false;
    recordButton.disabled = false;
  }
  
  // Add this function to create a timeout promise
  function timeoutPromise(ms, promise, errorMessage) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(errorMessage || `Request timed out after ${ms}ms`));
      }, ms);
      
      promise.then(
        (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      );
    });
  }
  
  // Update handleSendMessage to show/hide loading
  async function handleSendMessage() {
    const text = textInput.value.trim();
    
    if (!text) return;
    
    // Clear input
    textInput.value = '';
    
    // Display user message
    addMessage('user', text);
    
    // Show loading indicator
    showLoading();
    
    try {
      console.log('Sending message for interpretation:', text);
      
      // Interpret the command with timeout
      const interpretResponse = await timeoutPromise(
        30000, // 30 second timeout
        fetch('/api/interpret', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        }),
        'The request took too long to complete. Please try again.'
      );
      
      if (!interpretResponse.ok) {
        throw new Error(`Server responded with ${interpretResponse.status}`);
      }
      
      const interpretData = await interpretResponse.json();
      console.log('Interpretation result:', interpretData);
      
      // Check if we have an action
      if (interpretData.action) {
        console.log('Action type:', interpretData.action.actionType);
        
        // Handle different action types
        switch (interpretData.action.actionType) {
          case 'storeContext':
            addMessage('assistant', 'I\'ll remember that for context.');
            break;
            
          case 'message':
            console.log('Displaying message:', interpretData.action.parameters.message);
            addMessage('assistant', interpretData.action.parameters.message);
            break;
            
          case 'error':
            addMessage('assistant', interpretData.action.parameters.message);
            break;
            
          default:
            // For other action types, execute the action
            console.log('Executing action:', interpretData.action);
            
            const executeResponse = await fetch('/api/execute', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ action: interpretData.action })
            });
            
            if (!executeResponse.ok) {
              throw new Error(`Server responded with ${executeResponse.status}`);
            }
            
            const executeData = await executeResponse.json();
            console.log('Execution result:', executeData);
            
            // Display the result
            if (executeData.result) {
              addMessage('assistant', executeData.result.message);
            }
        }
      } else {
        console.error('No action in response:', interpretData);
        addMessage('assistant', 'I received a response but couldn\'t understand it. Please try again.');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('assistant', 'Sorry, I encountered an error processing your request: ' + error.message);
    } finally {
      // Hide loading indicator when done
      hideLoading();
    }
  }
  
  async function startRecording() {
    try {
      console.log('Starting recording...');
      
      if (isRecording) {
        console.log('Already recording, ignoring request');
        return;
      }
      
      console.log('Requesting microphone access');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      console.log('Setting up dataavailable event handler');
      mediaRecorder.addEventListener('dataavailable', (event) => {
        console.log('Data available event fired, chunk size:', event.data.size);
        audioChunks.push(event.data);
      });
      
      console.log('Starting media recorder');
      mediaRecorder.start();
      isRecording = true;
      recordButton.classList.add('recording');
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access your microphone. Please check your browser permissions: ' + error.message);
    }
  }
  
  async function stopRecording() {
    if (!isRecording) {
      console.log('Not recording, nothing to stop');
      return;
    }
    
    console.log('Stopping recording...');
    
    mediaRecorder.addEventListener('stop', async () => {
      console.log('Stop event fired, chunks collected:', audioChunks.length);
      
      if (audioChunks.length === 0) {
        console.warn('No audio chunks collected');
        return;
      }
      
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      console.log('Audio blob created, size:', audioBlob.size);
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      // Show loading indicator
      showLoading();
      
      try {
        console.log('Sending audio for transcription');
        // Transcribe audio
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });
        
        console.log('Transcription response status:', response.status);
        const data = await response.json();
        console.log('Transcription result:', data);
        
        if (data.text) {
          textInput.value = data.text;
          handleSendMessage();
        } else {
          console.warn('No transcription text received');
          hideLoading(); // Hide loading if no text received
        }
      } catch (error) {
        console.error('Error transcribing audio:', error);
        hideLoading(); // Hide loading on error
      }
    });
    
    try {
      mediaRecorder.stop();
      console.log('MediaRecorder stopped');
      
      // Stop all tracks in the stream to release the microphone
      mediaRecorder.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped');
      });
    } catch (error) {
      console.error('Error stopping MediaRecorder:', error);
      hideLoading(); // Hide loading on error
    }
    
    isRecording = false;
    recordButton.classList.remove('recording');
    console.log('Recording stopped');
  }
  
  function displayMessages(messages) {
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
      addMessageToDOM(message.role, message.content);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addMessage(role, content) {
    console.log(`Adding message - Role: ${role}, Content: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
    
    // Add to DOM
    addMessageToDOM(role, content);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addMessageToDOM(role, content) {
    console.log(`Adding to DOM - Role: ${role}`);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (role === 'user') {
      messageElement.classList.add('user-message');
      messageElement.textContent = content;
    } else {
      messageElement.classList.add('assistant-message');
      
      // Check if the content contains Jira issue information
      if (content.includes('Issue Key:')) {
        // Format the message with proper HTML
        let formattedContent = content
          .replace(/\n/g, '<br>')
          .replace(/Issue Key: ([\w-]+)/g, (match, issueKey) => {
            return `<span class="issue-key">${issueKey}</span> <button class="delete-issue-btn" data-issue-key="${issueKey}">Delete</button>`;
          });
        
        messageElement.innerHTML = formattedContent;
        
        // Add event listeners to delete buttons
        messageElement.querySelectorAll('.delete-issue-btn').forEach(button => {
          button.addEventListener('click', () => {
            const issueKey = button.getAttribute('data-issue-key');
            deleteIssue(issueKey);
          });
        });
      } else {
        // Regular message
        messageElement.textContent = content;
      }
    }
    
    chatMessages.appendChild(messageElement);
    console.log('Message added to DOM');
  }
  
  // Add this function to handle issue deletion
  async function deleteIssue(issueKey) {
    if (!confirm(`Are you sure you want to delete issue ${issueKey}? This action cannot be undone.`)) {
      return;
    }
    
    showLoading();
    
    try {
      const response = await fetch(`/api/jira/issue/${issueKey}`, {
        method: 'DELETE'
      });
      
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
}); 