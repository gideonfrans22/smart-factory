/**
 * User Online Tracking Service
 *
 * Tracks which users are currently online via WebSocket connections.
 * Uses Redis for persistence across server restarts and cluster mode.
 */

import { createClient, RedisClientType } from "redis";
import { loggerService } from "@shared/services";
import { userOnlineService } from "../../modules/user/user-online.service";
import { OnlineUser } from "../../modules/user/user.types";

const REDIS_ONLINE_USERS_KEY = "online_users";
const REDIS_SOCKET_TO_USER_KEY = "socket_to_user";

let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

const inMemoryOnlineUsers = new Map<string, OnlineUser>();
const inMemorySocketToUser = new Map<string, string>();

export async function initializeUserOnlineService(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on("error", (err) => {
      loggerService.error("Redis error in UserOnlineService", {
        error: err.message
      });
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
    loggerService.error("Failed to connect to Redis for UserOnlineService", {
      error: (error as Error).message
    });
    loggerService.warn("Using in-memory fallback for online user tracking");
    isRedisConnected = false;
  }
}

export async function registerUserOnline(
  socketId: string,
  userId: string,
  role: string,
  name: string
): Promise<void> {
  const user = userOnlineService.formatOnlineUser(userId, role, name, socketId);

  if (isRedisConnected && redisClient) {
    try {
      const existingUserJson = await redisClient.hGet(
        REDIS_ONLINE_USERS_KEY,
        userId
      );
      if (existingUserJson) {
        const existingUser: OnlineUser = JSON.parse(existingUserJson);
        await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, existingUser.socketId);
      }

      await redisClient.hSet(
        REDIS_ONLINE_USERS_KEY,
        userId,
        JSON.stringify(user)
      );
      await redisClient.hSet(REDIS_SOCKET_TO_USER_KEY, socketId, userId);

      loggerService.info(`[Redis] User online: ${name} (${role})`, {
        userId,
        socketId,
        role,
        name
      });
    } catch (error) {
      loggerService.error("Redis error in registerUserOnline", {
        error: (error as Error).message
      });
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

  const user = userOnlineService.formatOnlineUser(userId, role, name, socketId);
  inMemoryOnlineUsers.set(userId, user);
  inMemorySocketToUser.set(socketId, userId);

  loggerService.info(`[Memory] User online: ${name} (${role})`, {
    userId,
    socketId,
    role,
    name
  });
}

export async function unregisterUserOnline(
  socketId: string
): Promise<OnlineUser | undefined> {
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

      if (user.socketId === socketId) {
        await redisClient.hDel(REDIS_ONLINE_USERS_KEY, userId);
        await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, socketId);
        loggerService.info(
          `[Redis] User offline: ${user.name} (${user.role})`,
          { userId: user.userId, socketId, role: user.role, name: user.name }
        );
        return user;
      }

      await redisClient.hDel(REDIS_SOCKET_TO_USER_KEY, socketId);
      return undefined;
    } catch (error) {
      loggerService.error("Redis error in unregisterUserOnline", {
        error: (error as Error).message
      });
      return unregisterUserOnlineInMemory(socketId);
    }
  } else {
    return unregisterUserOnlineInMemory(socketId);
  }
}

function unregisterUserOnlineInMemory(
  socketId: string
): OnlineUser | undefined {
  const userId = inMemorySocketToUser.get(socketId);
  if (!userId) return undefined;

  const user = inMemoryOnlineUsers.get(userId);
  if (user && user.socketId === socketId) {
    inMemoryOnlineUsers.delete(userId);
    inMemorySocketToUser.delete(socketId);
    loggerService.info(`[Memory] User offline: ${user.name} (${user.role})`, {
      userId: user.userId,
      socketId,
      role: user.role,
      name: user.name
    });
    return user;
  }

  inMemorySocketToUser.delete(socketId);
  return undefined;
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (isRedisConnected && redisClient) {
    try {
      const exists = await redisClient.hExists(REDIS_ONLINE_USERS_KEY, userId);
      return Boolean(exists);
    } catch (error) {
      loggerService.error("Redis error in isUserOnline", {
        error: (error as Error).message,
        userId
      });
      return inMemoryOnlineUsers.has(userId);
    }
  }
  return inMemoryOnlineUsers.has(userId);
}

export async function getOnlineCountByRole(): Promise<{
  admin: number;
  monitor: number;
  worker: number;
}> {
  if (isRedisConnected && redisClient) {
    try {
      const allUsers = await redisClient.hGetAll(REDIS_ONLINE_USERS_KEY);
      const users: OnlineUser[] = Object.values(allUsers)
        .map((userJson) => {
          try {
            return JSON.parse(userJson);
          } catch (e) {
            return null;
          }
        })
        .filter((u): u is OnlineUser => u !== null);

      return userOnlineService.countByRole(users);
    } catch (error) {
      loggerService.error("Redis error in getOnlineCountByRole", {
        error: (error as Error).message
      });
      return getOnlineCountByRoleInMemory();
    }
  }

  return getOnlineCountByRoleInMemory();
}

function getOnlineCountByRoleInMemory(): {
  admin: number;
  monitor: number;
  worker: number;
} {
  const users = Array.from(inMemoryOnlineUsers.values());
  return userOnlineService.countByRole(users);
}

export async function getAllOnlineUsers(): Promise<OnlineUser[]> {
  if (isRedisConnected && redisClient) {
    try {
      const allUsers = await redisClient.hGetAll(REDIS_ONLINE_USERS_KEY);
      return Object.values(allUsers).map((json) => JSON.parse(json));
    } catch (error) {
      loggerService.error("Redis error in getAllOnlineUsers", {
        error: (error as Error).message
      });
      return Array.from(inMemoryOnlineUsers.values());
    }
  }
  return Array.from(inMemoryOnlineUsers.values());
}

export async function getOnlineUsersByRole(
  role: string
): Promise<OnlineUser[]> {
  const allUsers = await getAllOnlineUsers();
  return userOnlineService.filterByRole(allUsers, role);
}

export async function getTotalOnlineCount(): Promise<number> {
  if (isRedisConnected && redisClient) {
    try {
      const count = await redisClient.hLen(REDIS_ONLINE_USERS_KEY);
      return count;
    } catch (error) {
      loggerService.error("Redis error in getTotalOnlineCount", {
        error: (error as Error).message
      });
      return inMemoryOnlineUsers.size;
    }
  }
  return inMemoryOnlineUsers.size;
}
