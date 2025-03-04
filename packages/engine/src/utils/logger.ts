import fs from 'fs';
import path from 'path';
import util from 'util';

// Logger interface
export interface Logger {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  logToFile: (message: string) => void;
}

// Default logger that logs to console
const defaultLogger: Logger = {
  info: (message, ...args) => console.info(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
  logToFile: (message) => console.log(message) // No-op for default logger
};

// Singleton logger instance
export let logger: Logger = defaultLogger;

// Store logs directory path
let LOGS_DIR: string = '';

// Configure the logger with a logs directory
export function configureLogger(logsDir: string): Logger {
  // Store logs directory for later use
  LOGS_DIR = logsDir;
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create a log file for this session
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const logFilePath = path.join(logsDir, `log-${timestamp}.txt`);
  
  // Create a function to log to file
  const logToFile = (message: string): void => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    fs.appendFileSync(logFilePath, logMessage);
  };
  
  // Create enhanced logger that logs to both console and file
  const enhancedLogger: Logger = {
    info: (message, ...args) => {
      defaultLogger.info(message, ...args);
      logToFile(`[INFO] ${message} ${args.length ? JSON.stringify(args) : ''}`);
    },
    error: (message, ...args) => {
      defaultLogger.error(message, ...args);
      logToFile(`[ERROR] ${message} ${args.length ? JSON.stringify(args) : ''}`);
    },
    warn: (message, ...args) => {
      defaultLogger.warn(message, ...args);
      logToFile(`[WARN] ${message} ${args.length ? JSON.stringify(args) : ''}`);
    },
    debug: (message, ...args) => {
      defaultLogger.debug(message, ...args);
      logToFile(`[DEBUG] ${message} ${args.length ? JSON.stringify(args) : ''}`);
    },
    logToFile
  };
  
  // Update the singleton logger
  logger = enhancedLogger;
  
  return enhancedLogger;
}

// Create a logging function for structured data
export function logToFile(type: string, data: any, logFile: string = 'engine.log') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    data
  };
  
  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Append to log file
  fs.appendFileSync(
    path.join(LOGS_DIR, logFile), 
    JSON.stringify(logEntry, null, 2) + ',\n', 
    { flag: 'a+' }
  );
  
  // Also log to console for immediate feedback
  console.log(`[${timestamp}] [${type}]`, util.inspect(data, { depth: null, colors: true }));
} 