import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Message, Chat } from './types';
import { logger } from '../../utils/logger';

export function configureMessageStore(config: any) {
  const dataDir = config.dataDir;
  const chatsFilePath = path.join(dataDir, 'chats.json');
  
  // Initialize chats storage
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(chatsFilePath)) {
    fs.writeFileSync(chatsFilePath, JSON.stringify([]));
  }
  
  function loadChats(): Chat[] {
    try {
      const data = fs.readFileSync(chatsFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading chats:', error);
      return [];
    }
  }
  
  function saveChats(chats: Chat[]): void {
    try {
      fs.writeFileSync(chatsFilePath, JSON.stringify(chats, null, 2));
    } catch (error) {
      logger.error('Error saving chats:', error);
    }
  }
  
  function getChat(chatId: string): Chat | null {
    const chats = loadChats();
    return chats.find(chat => chat.id === chatId) || null;
  }
  
  function createChat(): Chat {
    const newChat: Chat = {
      id: uuidv4(),
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    
    const chats = loadChats();
    chats.push(newChat);
    saveChats(chats);
    
    return newChat;
  }
  
  function addMessage(chatId: string, role: 'user' | 'assistant' | 'system', content: string): Message {
    const chats = loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) {
      throw new Error(`Chat with ID ${chatId} not found`);
    }
    
    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now()
    };
    
    chats[chatIndex].messages.push(message);
    chats[chatIndex].updatedAt = Date.now();
    
    saveChats(chats);
    return message;
  }
  
  return {
    loadChats,
    getChat,
    createChat,
    addMessage
  };
} 