import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { configureEngine } from '@doit-jira/engine';
import { AIProviderType } from '@doit-jira/engine/dist/adapters/ai/types';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',  // Allow all origins during development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Set up multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create necessary directories
const dataDir = path.join(__dirname, '../data');
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
console.log('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
console.log('JIRA_BASE_URL', process.env.JIRA_BASE_URL);
console.log('JIRA_EMAIL', process.env.JIRA_EMAIL);
console.log('JIRA_API_TOKEN', process.env.JIRA_API_TOKEN);

const aiProvider = process.env.AI_PROVIDER as AIProviderType || 'gemini';
const aiApiKey = process.env[`${aiProvider.toUpperCase()}_API_KEY`] || '';

// Configure the engine
const engine = configureEngine({
  aiApiKey,
  aiProvider,
  jiraBaseUrl: process.env.JIRA_BASE_URL || '',
  jiraEmail: process.env.JIRA_EMAIL || '',
  jiraApiToken: process.env.JIRA_API_TOKEN || '',
  logsDir,
  dataDir
});

// Add this before your routes
app.options('*', cors()); // Enable preflight for all routes

// API Routes
// Transcribe audio
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('Received transcription request');
    console.log('Headers:', req.headers);
    
    if (!req.file) {
      console.error('No audio file provided');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    console.log('Received audio file:', req.file.originalname, 'Size:', req.file.size, 'MIME type:', req.file.mimetype);
    
    const audioBuffer = req.file.buffer;
    
    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('Empty audio buffer');
      return res.status(400).json({ error: 'Empty audio file' });
    }
    
    console.log('Sending audio buffer to transcription service');
    const text = await engine.transcribeAudio(audioBuffer);
    console.log('Transcription result:', text);
    
    res.json({ text });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: 'Failed to transcribe audio: ' + error.message });
  }
});

// Interpret command
app.post('/api/interpret', async (req, res) => {
  try {
    const { text, context, chatHistory } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    console.log('Interpreting command:', text);
    if (context) {
      console.log('With context:', JSON.stringify(context).substring(0, 200) + '...');
    }
    
    const action = await engine.interpretCommand(text, context, chatHistory);
    console.log('Interpretation result:', action);
    
    // Log the response we're sending back
    console.log('Sending response:', { action });
    
    res.json({ action });
  } catch (error: any) {
    console.error('Error interpreting command:', error);
    
    // Return a formatted error response
    const errorResponse = { 
      action: {
        actionType: 'error',
        parameters: {
          message: 'Sorry, I encountered an error processing your request: ' + error.message
        }
      }
    };
    
    console.log('Sending error response:', errorResponse);
    
    res.status(500).json(errorResponse);
  }
});

// Execute action
app.post('/api/execute', async (req, res) => {
  try {
    const { action, context } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'No action provided' });
    }
    
    console.log('[INFO] Executing action:', action);
    
    try {
      const result = await engine.executeAction(action, context);
      return res.json({ result });
    } catch (error: any) {
      console.error('[ERROR] Error executing action:', error);
      
      // Format the error response
      let errorMessage = error.message || 'Unknown error';
      let statusCode = 500;
      
      // Check for specific error types
      if (errorMessage.includes('401 Unauthorized')) {
        errorMessage = 'Authentication failed. Please check your Jira API token and credentials.';
        statusCode = 401;
      } else if (errorMessage.includes('403 Forbidden')) {
        errorMessage = 'You do not have permission to perform this action in Jira.';
        statusCode = 403;
      } else if (errorMessage.includes('404 Not Found')) {
        errorMessage = 'The requested Jira resource was not found.';
        statusCode = 404;
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage,
        actionType: 'error',
        parameters: {
          message: `I encountered an error while trying to execute that action: ${errorMessage}`
        }
      });
    }
  } catch (error: any) {
    console.error('[ERROR] Unexpected error in execute endpoint:', error);
    return res.status(500).json({ 
      error: error.message || 'Unexpected error',
      actionType: 'error',
      parameters: {
        message: 'Sorry, I encountered an unexpected error. Please try again.'
      }
    });
  }
});

// Get Jira issue
app.get('/api/jira/issue/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const issue = await engine.getIssue({ issueKey });
    res.json(issue);
  } catch (error: any) {
    console.error('Error getting issue:', error);
    res.status(500).json({ error: 'Failed to get issue' });
  }
});

// Search Jira issues
app.post('/api/jira/search', async (req, res) => {
  try {
    const { jql, maxResults } = req.body;
    const issues = await engine.searchIssues({ jql, maxResults });
    res.json(issues);
  } catch (error: any) {
    console.error('Error searching issues:', error);
    res.status(500).json({ error: 'Failed to search issues' });
  }
});

// Get project info
app.get('/api/jira/project/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;
    const project = await engine.getProjectInfo({ projectKey });
    res.json(project);
  } catch (error: any) {
    console.error('Error getting project info:', error);
    res.status(500).json({ error: 'Failed to get project info' });
  }
});

// Create a new chat
app.post('/api/chats/new', (req, res) => {
  try {
    const newChat = engine.createNewChat();
    res.json({ success: true, chat: newChat });
  } catch (error: any) {
    console.error('Error creating new chat:', error);
    res.status(500).json({ error: 'Failed to create new chat' });
  }
});

// Get active chat
app.get('/api/chats/active', (req, res) => {
  try {
    const chat = engine.getActiveChat();
    res.json({ chat });
  } catch (error: any) {
    console.error('Error getting active chat:', error);
    res.status(500).json({ error: 'Failed to get active chat' });
  }
});

// Get all chats
app.get('/api/chats', (req, res) => {
  try {
    const chats = engine.getChats();
    res.json({ chats });
  } catch (error: any) {
    console.error('Error getting chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Clear chat
app.post('/api/chats/clear', (req, res) => {
  try {
    const newChat = engine.clearChat();
    res.json({ success: true, newChatId: newChat.id });
  } catch (error: any) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

// Get messages from the active chat
app.get('/api/chats/active/messages', (req, res) => {
  try {
    const messages = engine.getMessages();
    res.json({ messages });
  } catch (error: any) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Set active chat
app.post('/api/chats/:chatId/activate', (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = engine.setActiveChat(chatId);
    res.json({ success: true, chat });
  } catch (error: any) {
    console.error('Error setting active chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a Jira issue
app.delete('/api/jira/issue/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    
    if (!issueKey) {
      return res.status(400).json({ error: 'Issue key is required' });
    }
    
    console.log(`Received request to delete issue ${issueKey}`);
    
    const result = await engine.deleteIssue({ issueKey });
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error: any) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ error: 'Failed to delete issue: ' + error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 