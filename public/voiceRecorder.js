document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordingTime = document.getElementById('recordingTime');
    const transcriptionText = document.getElementById('transcriptionText');
    const actionText = document.getElementById('actionText');
    const resultText = document.getElementById('resultText');
    const chatMessages = document.getElementById('chatMessages');
    const newChatButton = document.getElementById('newChatButton');
    const clearChatButton = document.getElementById('clearChatButton');

    let mediaRecorder;
    let audioChunks = [];
    let startTime;
    let timerInterval;
    let isRecording = false;

    // Initialize by loading chat messages
    loadChatMessages();

    // Request microphone access
    async function setupRecorder() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await processAudio(audioBlob);
            };
            
            return true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            recordingStatus.textContent = 'Error: Microphone access denied';
            return false;
        }
    }

    // Process the recorded audio
    async function processAudio(audioBlob) {
        recordingStatus.textContent = 'Processing audio...';
        
        // Create form data to send the audio file
        const formData = new FormData();
        formData.append('audio', audioBlob);
        
        try {
            // Send audio for transcription
            const transcriptionResponse = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!transcriptionResponse.ok) {
                throw new Error('Transcription failed');
            }
            
            const transcriptionData = await transcriptionResponse.json();
            transcriptionText.textContent = transcriptionData.text;
            
            // Add user message to UI
            addMessageToUI('user', transcriptionData.text);
            
            // Process transcription with OpenAI to determine Jira action
            recordingStatus.textContent = 'Interpreting command...';
            const actionResponse = await fetch('/api/interpret', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: transcriptionData.text })
            });
            
            if (!actionResponse.ok) {
                throw new Error('Command interpretation failed');
            }
            
            const actionData = await actionResponse.json();
            actionText.textContent = JSON.stringify(actionData.action, null, 2);
            
            // Execute the Jira action
            recordingStatus.textContent = 'Executing Jira action...';
            const jiraResponse = await fetch('/api/execute-jira-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: actionData.action })
            });
            
            if (!jiraResponse.ok) {
                throw new Error('Jira action execution failed');
            }
            
            const jiraData = await jiraResponse.json();
            resultText.textContent = jiraData.message;
            resultText.className = jiraData.success ? 'result-text success' : 'result-text error';
            
            // Add special styling for context-only messages
            if (jiraData.isContextOnly) {
                resultText.className = 'result-text context';
                actionText.textContent = 'No action needed - storing as context';
            }
            
            // Add special handling for error responses
            if (jiraData.isError) {
                actionText.textContent = 'Error processing request';
            }
            
            // Add assistant message to UI
            addMessageToUI('assistant', jiraData.message);
            
            recordingStatus.textContent = 'Command processed successfully';
            
            // Reload chat messages to ensure UI is in sync with server
            loadChatMessages();
        } catch (error) {
            console.error('Error processing audio:', error);
            recordingStatus.textContent = `Error: ${error.message}`;
            resultText.textContent = `Failed to process command: ${error.message}`;
            resultText.className = 'result-text error';
        }
    }

    // Update the recording timer
    function updateRecordingTime() {
        const currentTime = new Date();
        const elapsedTime = new Date(currentTime - startTime);
        const minutes = elapsedTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = elapsedTime.getUTCSeconds().toString().padStart(2, '0');
        recordingTime.textContent = `${minutes}:${seconds}`;
    }

    // Toggle recording state
    async function toggleRecording() {
        if (!isRecording) {
            // Start recording
            const setupSuccess = await setupRecorder();
            if (!setupSuccess) return;
            
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            
            recordButton.classList.add('recording');
            recordButton.querySelector('.record-text').textContent = 'Stop Recording';
            recordingStatus.textContent = 'Recording...';
            
            startTime = new Date();
            timerInterval = setInterval(updateRecordingTime, 1000);
            
            // Reset UI elements
            transcriptionText.textContent = 'Your transcribed voice will appear here...';
            actionText.textContent = 'The interpreted action will appear here...';
            resultText.textContent = 'The result of the action will appear here...';
            resultText.className = 'result-text';
        } else {
            // Stop recording
            mediaRecorder.stop();
            isRecording = false;
            
            recordButton.classList.remove('recording');
            recordButton.querySelector('.record-text').textContent = 'Start Recording';
            recordingStatus.textContent = 'Processing...';
            
            clearInterval(timerInterval);
        }
    }

    // Load chat messages from the server
    async function loadChatMessages() {
        try {
            const response = await fetch('/api/chats/active/messages');
            if (!response.ok) {
                throw new Error('Failed to load chat messages');
            }
            
            const data = await response.json();
            renderChatMessages(data.messages);
        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }

    // Render chat messages in the UI
    function renderChatMessages(messages) {
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            chatMessages.innerHTML = '<div class="empty-chat-message">No messages yet. Start by recording a voice command.</div>';
            return;
        }
        
        messages.forEach(message => {
            if (message.role === 'system') return; // Skip system messages
            
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${message.role}-message`;
            
            const contentElement = document.createElement('div');
            contentElement.className = 'message-content';
            contentElement.textContent = message.content;
            
            const timeElement = document.createElement('div');
            timeElement.className = 'message-time';
            timeElement.textContent = new Date(message.timestamp).toLocaleTimeString();
            
            messageElement.appendChild(contentElement);
            messageElement.appendChild(timeElement);
            
            chatMessages.appendChild(messageElement);
        });
        
        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add a message to the UI
    function addMessageToUI(role, content) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${role}-message`;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.textContent = content;
        
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = new Date().toLocaleTimeString();
        
        messageElement.appendChild(contentElement);
        messageElement.appendChild(timeElement);
        
        // Remove empty chat message if present
        const emptyMessage = chatMessages.querySelector('.empty-chat-message');
        if (emptyMessage) {
            chatMessages.removeChild(emptyMessage);
        }
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Create a new chat
    async function createNewChat() {
        try {
            const response = await fetch('/api/chats', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to create new chat');
            }
            
            // Reset UI elements
            transcriptionText.textContent = 'Your transcribed voice will appear here...';
            actionText.textContent = 'The interpreted action will appear here...';
            resultText.textContent = 'The result of the action will appear here...';
            resultText.className = 'result-text';
            
            // Load the new empty chat
            loadChatMessages();
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }

    // Clear the active chat
    async function clearChat() {
        try {
            const response = await fetch('/api/chats/active', {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to clear chat');
            }
            
            // Reset UI elements
            transcriptionText.textContent = 'Your transcribed voice will appear here...';
            actionText.textContent = 'The interpreted action will appear here...';
            resultText.textContent = 'The result of the action will appear here...';
            resultText.className = 'result-text';
            
            // Load the new empty chat
            loadChatMessages();
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }

    // Add event listeners
    recordButton.addEventListener('click', toggleRecording);
    newChatButton.addEventListener('click', createNewChat);
    clearChatButton.addEventListener('click', clearChat);
}); 