require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const util = require('util');

// Import services
const transcriptionService = require('./transcriptionService');
const openaiService = require('./openaiService');
const jiraService = require('./jiraService');
const chatService = require('./chatService');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Set up multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create necessary directories
const dataDir = path.join(__dirname, '../data');
const chatsDir = path.join(__dirname, '../data/chats');
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(chatsDir)) {
    fs.mkdirSync(chatsDir, { recursive: true });
}

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create a logging function
function logToFile(type, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        data
    };
    
    // Append to log file
    fs.appendFileSync(
        path.join(__dirname, '../logs/app.log'), 
        JSON.stringify(logEntry, null, 2) + ',\n', 
        { flag: 'a+' }
    );
    
    // Also log to console for immediate feedback
    console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
}

// Routes
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            logToFile('TRANSCRIBE_ERROR', { error: 'No audio file provided' });
            return res.status(400).json({ error: 'No audio file provided' });
        }

        logToFile('TRANSCRIBE_REQUEST', { 
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
        
        const transcription = await transcriptionService.transcribeAudio(req.file.buffer);
        
        logToFile('TRANSCRIBE_RESPONSE', { transcription });
        res.json({ text: transcription });
    } catch (error) {
        logToFile('TRANSCRIBE_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Transcription error:', error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

app.post('/api/interpret', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            logToFile('INTERPRET_ERROR', { error: 'No text provided' });
            return res.status(400).json({ error: 'No text provided' });
        }

        logToFile('INTERPRET_REQUEST', { text });
        
        const action = await openaiService.interpretCommand(text);
        
        logToFile('INTERPRET_RESPONSE', { action });
        res.json({ action });
    } catch (error) {
        logToFile('INTERPRET_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Interpretation error:', error);
        res.status(500).json({ error: 'Failed to interpret command' });
    }
});

app.post('/api/execute-jira-action', async (req, res) => {
    try {
        const { action } = req.body;
        if (!action) {
            logToFile('JIRA_ACTION_ERROR', { error: 'No action provided' });
            return res.status(400).json({ error: 'No action provided' });
        }

        logToFile('JIRA_ACTION_REQUEST', { action });

        // Handle context-only messages
        if (action.actionType === 'storeContext') {
            const response = {
                success: true,
                message: 'Context stored for future reference.',
                isContextOnly: true
            };
            logToFile('JIRA_ACTION_CONTEXT', { response });
            return res.json(response);
        }
        
        // Handle error messages from the AI
        if (action.actionType === 'error') {
            const response = {
                success: false,
                message: action.parameters.message,
                isError: true
            };
            logToFile('JIRA_ACTION_ERROR_RESPONSE', { response });
            return res.json(response);
        }

        const result = await jiraService.executeAction(action);
        
        logToFile('JIRA_ACTION_RESPONSE', { result });
        res.json(result);
    } catch (error) {
        logToFile('JIRA_ACTION_ERROR', { 
            error: error.message,
            stack: error.stack
        });
        console.error('Jira execution error:', error);
        res.status(500).json({ 
            success: false, 
            message: `Failed to execute Jira action: ${error.message}` 
        });
    }
});

// Get all chats
app.get('/api/chats', (req, res) => {
    try {
        const chats = chatService.getAllChats();
        res.json({ chats });
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({ error: 'Failed to get chats' });
    }
});

// Create a new chat
app.post('/api/chats', (req, res) => {
    try {
        const chatId = chatService.createNewChat();
        res.json({ chatId });
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

// Clear the active chat
app.delete('/api/chats/active', (req, res) => {
    try {
        const newChat = chatService.clearChat();
        res.json({ success: true, newChatId: newChat.id });
    } catch (error) {
        console.error('Error clearing chat:', error);
        res.status(500).json({ error: 'Failed to clear chat' });
    }
});

// Get messages from the active chat
app.get('/api/chats/active/messages', (req, res) => {
    try {
        const messages = chatService.getMessages();
        res.json({ messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Set active chat
app.post('/api/chats/:chatId/activate', (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = chatService.setActiveChat(chatId);
        res.json({ success: true, chat });
    } catch (error) {
        console.error('Error setting active chat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 