import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const LOG_DIR = process.env.LOG_DIR || "./logs";
const LOG_LEVEL =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || "20m";
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || "14d";
const LOG_ENABLE_API = process.env.LOG_ENABLE_API !== "false";

// Custom format for log messages
const logFormat = winston.format.printf(
  ({ timestamp, level, message, processId, ...meta }) => {
    const pid = processId || process.pid;
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level}] [${pid}] ${message}${metaStr}`;
  }
);

// Create format with timestamp
const timestampFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  logFormat
);

// Daily rotate file transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  format: timestampFormat,
  level: "debug"
});

// Daily rotate file transport for error logs only
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  format: timestampFormat,
  level: "error"
});

// Console transport for development (formatted, colored output)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), timestampFormat),
  level: LOG_LEVEL
});

// Create Winston logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: timestampFormat,
  transports: [
    combinedRotateTransport,
    errorRotateTransport,
    ...(process.env.NODE_ENV !== "production" ? [consoleTransport] : [])
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      format: timestampFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      format: timestampFormat
    })
  ]
});

// Helper method for API request logging
export const logAPIRequest = (
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  ip?: string,
  userAgent?: string,
  userId?: string
): void => {
  if (!LOG_ENABLE_API) return;

  const logLevel =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  const message = `${method} ${path} ${statusCode} ${durationMs}ms`;

  logger.log(logLevel, message, {
    processId: process.pid,
    ip,
    userAgent,
    userId,
    statusCode,
    durationMs
  });
};

// Helper method for MQTT event logging
export const logMQTTEvent = (
  event: string,
  topic?: string,
  payload?: string | object,
  error?: Error
): void => {
  const level = error ? "error" : "info";
  let message = `MQTT ${event}`;

  if (topic) {
    message += `: ${topic}`;
  }

  if (error) {
    message += ` - ${error.message}`;
  }

  // Truncate large payloads
  let payloadStr: string | undefined;
  if (payload) {
    payloadStr =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    if (payloadStr.length > 200) {
      payloadStr = payloadStr.substring(0, 200) + "... [truncated]";
    }
  }

  logger.log(level, message, {
    processId: process.pid,
    topic,
    payload: payloadStr,
    error: error ? error.stack : undefined
  });
};

// Helper method for WebSocket event logging
export const logWebSocketEvent = (
  event: string,
  socketId?: string,
  details?: Record<string, any>
): void => {
  const message = `WebSocket ${event}${socketId ? `: ${socketId}` : ""}`;

  logger.info(message, {
    processId: process.pid,
    socketId,
    ...details
  });
};

// Helper method for database event logging
export const logDatabaseEvent = (
  event: string,
  details?: Record<string, any>,
  error?: Error
): void => {
  const level = error ? "error" : "info";
  const message = `Database ${event}`;

  logger.log(level, message, {
    processId: process.pid,
    ...details,
    error: error ? error.stack : undefined
  });
};

// Helper method for scheduler event logging
export const logSchedulerEvent = (
  event: string,
  details?: Record<string, any>,
  error?: Error
): void => {
  const level = error ? "error" : "info";
  const message = `Scheduler ${event}`;

  logger.log(level, message, {
    processId: process.pid,
    ...details,
    error: error ? error.stack : undefined
  });
};

// Export logger instance with helper methods attached
export const loggerService = {
  error: (message: string, meta?: Record<string, any>) => {
    logger.error(message, { processId: process.pid, ...meta });
  },
  warn: (message: string, meta?: Record<string, any>) => {
    logger.warn(message, { processId: process.pid, ...meta });
  },
  info: (message: string, meta?: Record<string, any>) => {
    logger.info(message, { processId: process.pid, ...meta });
  },
  debug: (message: string, meta?: Record<string, any>) => {
    logger.debug(message, { processId: process.pid, ...meta });
  },
  logAPIRequest,
  logMQTTEvent,
  logWebSocketEvent,
  logDatabaseEvent,
  logSchedulerEvent
};

export default loggerService;
