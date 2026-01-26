/**
 * User Online Tracking Service
 * 
 * Tracks which users are currently online via WebSocket connections.
 * Uses Redis for persistence across server restarts and cluster mode.
 */

import { createClient, RedisClientType } from "redis";
import { loggerService } from "./loggerService";

interface OnlineUser {
  userId: string;
  role: string;
  name: string;
  socketId: string;
  connectedAt: string;
}

// Redis keys
const REDIS_ONLINE_USERS_KEY = "online_users"; // Hash: { oderId -> JSON(OnlineUser) }
const REDIS_SOCKET_TO_USER_KEY = "socket_to_user"; // Hash: { socketId -> userId }

// Redis client (will be initialized)
let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

// Fallback in-memory store (used when Redis is not available)
const inMemoryOnlineUsers = new Map<string, OnlineUser>();
const inMemorySocketToUser = new Map<string, string>();

/**
 * Initialize Redis connection for online user tracking
 */
export async function initializeUserOnlineService(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  
  try {
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on("error", (err) => {
      loggerService.error("Redis error in UserOnlineService", { error: err.message });
      isRedisConnected = false;
    });
    
    redisClient.on("connect", () => {
      loggerService.info("UserOnlineService connected to Redis");
      isRedisConnected = true;
    });
    
    redisClient.on("disconnect", () => {
      loggerService.warn("UserOnlineService disconnected from Redis");
      isRedisConnected = false;
    });
    
    await redisClient.connect();
    isRedisConnected = true;
    loggerService.info("UserOnlineService Redis initialized");
  } catch (error) {
    loggerService.error("Failed to connect to Redis for UserOnlineService", { error: (error as Error).message });
    loggerService.warn("Using in-memory fallback for online user tracking");
    isRedisConnected = false;
  }
}

/**
 * Register a user as online when they connect via WebSocket
 */
export async function registerUserOnline(
  socketId: string,
  userId: string,
  role: string,
  name: string
): Promise<void> {
  const user: OnlineUser = {
    userId,
    role,
    name,
    socketId,
    connectedAt: new Date().toISOString()
  };

  if (isRedisConnected && redisClient) {
    try {
      // Check if user already has a connection, remove old socket mapping
      const existingUserJson = await redisClient.hGet(REDIS_ONLINE_USERS_KEY, userId);
      if (existingUserJson) {
        const existingUser: OnlineUser = JSON.parse(existingUserJson);
        await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, existingUser.socketId);
      }
      
      // Store new connection
      await redisClient.hSet(REDIS_ONLINE_USERS_KEY, userId, JSON.stringify(user));
      await redisClient.hSet(REDIS_SOCKET_TO_USER_KEY, socketId, userId);
      
      loggerService.info(`[Redis] User online: ${name} (${role})`, { userId, socketId, role, name });
    } catch (error) {
      loggerService.error("Redis error in registerUserOnline", { error: (error as Error).message });
      // Fallback to in-memory
      registerUserOnlineInMemory(socketId, userId, role, name);
    }
  } else {
    registerUserOnlineInMemory(socketId, userId, role, name);
  }
}

function registerUserOnlineInMemory(
  socketId: string,
  userId: string,
  role: string,
  name: string
): void {
  const existingEntry = inMemoryOnlineUsers.get(userId);
  if (existingEntry) {
    inMemorySocketToUser.delete(existingEntry.socketId);
  }

  inMemoryOnlineUsers.set(userId, {
    userId,
    role,
    name,
    socketId,
    connectedAt: new Date().toISOString()
  });
  inMemorySocketToUser.set(socketId, userId);

  loggerService.info(`[Memory] User online: ${name} (${role})`, { userId, socketId, role, name });
}

/**
 * Unregister a user when they disconnect
 */
export async function unregisterUserOnline(socketId: string): Promise<OnlineUser | undefined> {
  if (isRedisConnected && redisClient) {
    try {
      const userId = await redisClient.hGet(REDIS_SOCKET_TO_USER_KEY, socketId);
      if (!userId) return undefined;

      const userJson = await redisClient.hGet(REDIS_ONLINE_USERS_KEY, userId);
      if (!userJson) {
        await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, socketId);
        return undefined;
      }

      const user: OnlineUser = JSON.parse(userJson);
      
      // Only remove if socket ID matches (prevents race conditions)
      if (user.socketId === socketId) {
        await redisClient.hDel(REDIS_ONLINE_USERS_KEY, userId);
        await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, socketId);
        loggerService.info(`[Redis] User offline: ${user.name} (${user.role})`, { userId: user.userId, socketId, role: user.role, name: user.name });
        return user;
      }

      await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, socketId);
      return undefined;
    } catch (error) {
      loggerService.error("Redis error in unregisterUserOnline", { error: (error as Error).message });
      return unregisterUserOnlineInMemory(socketId);
    }
  } else {
    return unregisterUserOnlineInMemory(socketId);
  }
}

function unregisterUserOnlineInMemory(socketId: string): OnlineUser | undefined {
  const userId = inMemorySocketToUser.get(socketId);
  if (!userId) return undefined;

  const user = inMemoryOnlineUsers.get(userId);
  if (user && user.socketId === socketId) {
    inMemoryOnlineUsers.delete(userId);
    inMemorySocketToUser.delete(socketId);
    loggerService.info(`[Memory] User offline: ${user.name} (${user.role})`, { userId: user.userId, socketId, role: user.role, name: user.name });
    return user;
  }

  inMemorySocketToUser.delete(socketId);
  return undefined;
}

/**
 * Check if a user is online
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (isRedisConnected && redisClient) {
    try {
      const exists = await redisClient.hExists(REDIS_ONLINE_USERS_KEY, userId);
      return Boolean(exists);
    } catch (error) {
      loggerService.error("Redis error in isUserOnline", { error: (error as Error).message, userId });
      return inMemoryOnlineUsers.has(userId);
    }
  }
  return inMemoryOnlineUsers.has(userId);
}

/**
 * Get count of online users by role
 */
export async function getOnlineCountByRole(): Promise<{ admin: number; monitor: number; worker: number }> {
  const counts = { admin: 0, monitor: 0, worker: 0 };

  if (isRedisConnected && redisClient) {
    try {
      const allUsers = await redisClient.hGetAll(REDIS_ONLINE_USERS_KEY);
      
      Object.values(allUsers).forEach((userJson) => {
        try {
          const user: OnlineUser = JSON.parse(userJson);
          if (user.role === "admin") counts.admin++;
          else if (user.role === "monitor") counts.monitor++;
          else if (user.role === "worker") counts.worker++;
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      return counts;
    } catch (error) {
      loggerService.error("Redis error in getOnlineCountByRole", { error: (error as Error).message });
      return getOnlineCountByRoleInMemory();
    }
  }
  
  return getOnlineCountByRoleInMemory();
}

function getOnlineCountByRoleInMemory(): { admin: number; monitor: number; worker: number } {
  const counts = { admin: 0, monitor: 0, worker: 0 };
  
  inMemoryOnlineUsers.forEach((user) => {
    if (user.role === "admin") counts.admin++;
    else if (user.role === "monitor") counts.monitor++;
    else if (user.role === "worker") counts.worker++;
  });

  return counts;
}

/**
 * Get all online users (for debugging/admin)
 */
export async function getAllOnlineUsers(): Promise<OnlineUser[]> {
  if (isRedisConnected && redisClient) {
    try {
      const allUsers = await redisClient.hGetAll(REDIS_ONLINE_USERS_KEY);
      return Object.values(allUsers).map((json) => JSON.parse(json));
    } catch (error) {
      loggerService.error("Redis error in getAllOnlineUsers", { error: (error as Error).message });
      return Array.from(inMemoryOnlineUsers.values());
    }
  }
  return Array.from(inMemoryOnlineUsers.values());
}

/**
 * Get online users by role
 */
export async function getOnlineUsersByRole(role: string): Promise<OnlineUser[]> {
  const allUsers = await getAllOnlineUsers();
  return allUsers.filter(user => user.role === role);
}

/**
 * Get total online count
 */
export async function getTotalOnlineCount(): Promise<number> {
  if (isRedisConnected && redisClient) {
    try {
      const count = await redisClient.hLen(REDIS_ONLINE_USERS_KEY);
      return count;
    } catch (error) {
      loggerService.error("Redis error in getTotalOnlineCount", { error: (error as Error).message });
      return inMemoryOnlineUsers.size;
    }
  }
  return inMemoryOnlineUsers.size;
}
