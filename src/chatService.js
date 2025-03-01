/**
 * Service for managing chat history and conversations
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Directory for storing chat data
const CHATS_DIR = path.join(__dirname, '../data/chats');

// Ensure the chats directory exists
if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
}

// File to store active chat ID
const ACTIVE_CHAT_FILE = path.join(CHATS_DIR, 'active-chat.json');

// Initialize active chat
let activeChat = {
    id: null,
    messages: []
};

// Load active chat from file if it exists
function loadActiveChat() {
    try {
        if (fs.existsSync(ACTIVE_CHAT_FILE)) {
            const activeChatData = JSON.parse(fs.readFileSync(ACTIVE_CHAT_FILE, 'utf8'));
            
            if (activeChatData && activeChatData.id) {
                const chatFile = path.join(CHATS_DIR, `${activeChatData.id}.json`);
                
                if (fs.existsSync(chatFile)) {
                    activeChat = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
                    console.log(`Loaded active chat: ${activeChat.id} with ${activeChat.messages.length} messages`);
                } else {
                    // If chat file doesn't exist, create a new chat
                    createNewChat();
                }
            } else {
                // If active chat data is invalid, create a new chat
                createNewChat();
            }
        } else {
            // If active chat file doesn't exist, create a new chat
            createNewChat();
        }
    } catch (error) {
        console.error('Error loading active chat:', error);
        // If there's an error, create a new chat
        createNewChat();
    }
}

// Save active chat to file
function saveActiveChat() {
    try {
        // Save active chat ID
        fs.writeFileSync(ACTIVE_CHAT_FILE, JSON.stringify({ id: activeChat.id }));
        
        // Save chat data
        const chatFile = path.join(CHATS_DIR, `${activeChat.id}.json`);
        fs.writeFileSync(chatFile, JSON.stringify(activeChat));
    } catch (error) {
        console.error('Error saving active chat:', error);
    }
}

/**
 * Creates a new chat session
 * @returns {string} The ID of the new chat
 */
function createNewChat() {
    activeChat = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        messages: []
    };
    
    saveActiveChat();
    return activeChat;
}

/**
 * Gets the active chat or creates one if none exists
 * @returns {Object} The active chat
 */
function getActiveChat() {
    if (!activeChat || !activeChat.id) {
        createNewChat();
    }
    
    return activeChat;
}

/**
 * Adds a message to the active chat
 * @param {string} role - The role of the message sender (user/assistant)
 * @param {string} content - The message content
 * @param {Object} metadata - Additional metadata for the message
 * @returns {Object} The updated chat
 */
function addMessage(role, content, metadata = {}) {
    const message = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        role,
        content,
        ...metadata
    };
    
    activeChat.messages.push(message);
    saveActiveChat();
    return message;
}

/**
 * Gets all messages from the active chat
 * @returns {Array} The messages in the active chat
 */
function getMessages() {
    return activeChat.messages;
}

/**
 * Gets all chats
 * @returns {Array} All chat sessions
 */
function getChats() {
    try {
        const chatFiles = fs.readdirSync(CHATS_DIR)
            .filter(file => file.endsWith('.json') && file !== 'active-chat.json');
        
        return chatFiles.map(file => {
            const chatData = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, file), 'utf8'));
            return {
                id: chatData.id,
                createdAt: chatData.createdAt,
                messageCount: chatData.messages.length,
                isActive: chatData.id === activeChat.id
            };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error('Error getting chats:', error);
        return [];
    }
}

/**
 * Clears the active chat
 * @returns {Object} The new empty chat
 */
function clearChat() {
    activeChat.messages = [];
    saveActiveChat();
    return activeChat;
}

/**
 * Sets the active chat
 * @param {string} chatId - The ID of the chat to set as active
 * @returns {Object} The activated chat
 */
function setActiveChat(chatId) {
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

module.exports = {
    createNewChat,
    getActiveChat,
    addMessage,
    getMessages,
    getChats,
    clearChat,
    setActiveChat
}; 