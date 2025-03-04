import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  metadata?: any;
}

interface Chat {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// Directory for storing chat data
const CHATS_DIR = path.join(process.cwd(), 'data/chats');

// Ensure the chats directory exists
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
}

// File to store active chat ID
const ACTIVE_CHAT_FILE = path.join(CHATS_DIR, 'active-chat.json');

// Initialize active chat
let activeChat: Chat = {
  id: '',
  name: 'New Chat',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// Load active chat from file if it exists
function loadActiveChat(): void {
  try {
    if (fs.existsSync(ACTIVE_CHAT_FILE)) {
      const activeChatData = JSON.parse(fs.readFileSync(ACTIVE_CHAT_FILE, 'utf8'));
      
      if (activeChatData.id) {
        const chatFile = path.join(CHATS_DIR, `${activeChatData.id}.json`);
        
        if (fs.existsSync(chatFile)) {
          activeChat = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
        } else {
          // If the chat file doesn't exist, create a new chat
          createNewChat();
        }
      } else {
        // If no active chat ID, create a new chat
        createNewChat();
      }
    } else {
      // If no active chat file, create a new chat
      createNewChat();
    }
  } catch (error) {
    console.error('Error loading active chat:', error);
    // If there's an error, create a new chat
    createNewChat();
  }
}

// Save active chat to file
function saveActiveChat(): void {
  try {
    // Save active chat ID
    fs.writeFileSync(ACTIVE_CHAT_FILE, JSON.stringify({ id: activeChat.id }, null, 2));
    
    // Save chat data
    fs.writeFileSync(
      path.join(CHATS_DIR, `${activeChat.id}.json`), 
      JSON.stringify(activeChat, null, 2)
    );
  } catch (error) {
    console.error('Error saving active chat:', error);
  }
}

/**
 * Creates a new chat
 * @returns {Chat} - The new chat
 */
export function createNewChat(): Chat {
  const newChat: Chat = {
    id: uuidv4(),
    name: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  activeChat = newChat;
  saveActiveChat();
  
  return newChat;
}

/**
 * Gets the active chat
 * @returns {Chat} - The active chat
 */
export function getActiveChat(): Chat {
  return activeChat;
}

/**
 * Adds a message to the active chat
 * @param {string} role - The role of the message sender (user, assistant)
 * @param {string} content - The content of the message
 * @param {Object} metadata - Optional metadata for the message
 * @returns {Message} - The added message
 */
export function addMessage(role: 'user' | 'assistant' | 'tool', content: string, metadata?: any): ChatMessage {
  const activeChat = getActiveChat();
  
  if (!activeChat) {
    throw new Error('No active chat found');
  }
  
  const message: ChatMessage = {
    id: uuidv4(),
    role,
    content,
    timestamp: Date.now(),
    metadata
  };
  
  activeChat.messages.push(message);
  activeChat.updatedAt = Date.now();
  
  // Update chat title if this is the first user message
  if (role === 'user' && activeChat.messages.filter(m => m.role === 'user').length === 1) {
    activeChat.name = content.substring(0, 30) + (content.length > 30 ? '...' : '');
  }
  
  saveActiveChat();
  
  return message;
}

/**
 * Gets messages from the active chat
 * @returns {Array<Message>} - The messages
 */
export function getMessages(): ChatMessage[] {
  return activeChat.messages;
}

// Add this interface for the chat summary objects
export interface ChatSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Gets all chats
 * @returns {Array<ChatSummary>} - The chat summaries
 */
export function getChats(): ChatSummary[] {
  try {
    const chatFiles = fs.readdirSync(CHATS_DIR)
      .filter(file => file.endsWith('.json') && file !== 'active-chat.json');
    
    const chats = chatFiles.map(file => {
      const chatData = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, file), 'utf8'));
      return {
        id: chatData.id,
        name: chatData.name,
        createdAt: chatData.createdAt,
        updatedAt: chatData.updatedAt,
        messageCount: chatData.messages.length
      };
    });
    
    // Sort by updated date (newest first)
    return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Error getting chats:', error);
    return [];
  }
}

/**
 * Clears the active chat and creates a new one
 * @returns {Chat} - The new chat
 */
export function clearChat(): Chat {
  return createNewChat();
}

/**
 * Sets the active chat
 * @param {string} chatId - The ID of the chat to set as active
 * @returns {Chat} - The active chat
 */
export function setActiveChat(chatId: string): Chat {
  try {
    const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
    
    if (fs.existsSync(chatFile)) {
      activeChat = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
      saveActiveChat();
      return activeChat;
    } else {
      throw new Error(`Chat with ID ${chatId} not found`);
    }
  } catch (error) {
    console.error('Error setting active chat:', error);
    throw error;
  }
}

// Initialize by loading the active chat
loadActiveChat(); 