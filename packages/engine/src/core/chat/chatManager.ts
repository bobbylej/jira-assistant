import { v4 as uuidv4 } from 'uuid';
import { Chat } from './types';
import { logger } from '../../utils/logger';

export function configureChatManager(messageStore: any) {
  let activeChat: Chat | null = null;
  
  function getActiveChat(): Chat {
    if (!activeChat) {
      // Load the most recent chat or create a new one
      const chats = messageStore.loadChats();
      
      if (chats.length > 0) {
        // Sort by updatedAt in descending order
        chats.sort((a: Chat, b: Chat) => b.updatedAt - a.updatedAt);
        activeChat = chats[0];
      } else {
        activeChat = messageStore.createChat();
      }
    }
    
    // At this point, activeChat should never be null
    return activeChat as Chat;
  }
  
  function setActiveChat(chatId: string): Chat {
    const chat = messageStore.getChat(chatId);
    
    if (!chat) {
      throw new Error(`Chat with ID ${chatId} not found`);
    }
    
    activeChat = chat;
    return activeChat as Chat;
  }
  
  function createNewChat(): Chat {
    activeChat = messageStore.createChat();
    return activeChat as Chat;
  }
  
  function clearChat(): Chat {
    return createNewChat();
  }
  
  function getChats(): Chat[] {
    return messageStore.loadChats();
  }
  
  function addMessage(role: 'user' | 'assistant' | 'system', content: string) {
    const chat = getActiveChat();
    return messageStore.addMessage(chat.id, role, content);
  }
  
  function getMessages() {
    const chat = getActiveChat();
    return chat.messages;
  }
  
  return {
    getActiveChat,
    setActiveChat,
    createNewChat,
    clearChat,
    getChats,
    addMessage,
    getMessages
  };
} 