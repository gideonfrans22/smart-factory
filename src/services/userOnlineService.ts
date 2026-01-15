/**
 * User Online Tracking Service
 * 
 * Tracks which users are currently online via WebSocket connections.
 * Used for real-time user statistics in admin dashboard and monitor TV.
 */

interface OnlineUser {
  userId: string;
  role: string;
  name: string;
  socketId: string;
  connectedAt: Date;
}

// In-memory store for online users (keyed by userId)
const onlineUsers = new Map<string, OnlineUser>();

// Socket ID to User ID mapping for quick lookup on disconnect
const socketToUser = new Map<string, string>();

/**
 * Register a user as online when they connect via WebSocket
 */
export function registerUserOnline(
  socketId: string,
  userId: string,
  role: string,
  name: string
): void {
  // Remove any existing connection for this user (handles reconnection)
  const existingEntry = onlineUsers.get(userId);
  if (existingEntry) {
    socketToUser.delete(existingEntry.socketId);
  }

  onlineUsers.set(userId, {
    userId,
    role,
    name,
    socketId,
    connectedAt: new Date()
  });
  socketToUser.set(socketId, userId);

  console.log(`👤 User online: ${name} (${role}) - Socket: ${socketId}`);
}

/**
 * Unregister a user when they disconnect
 */
export function unregisterUserOnline(socketId: string): OnlineUser | undefined {
  const userId = socketToUser.get(socketId);
  if (!userId) return undefined;

  const user = onlineUsers.get(userId);
  if (user && user.socketId === socketId) {
    onlineUsers.delete(userId);
    socketToUser.delete(socketId);
    console.log(`👤 User offline: ${user.name} (${user.role})`);
    return user;
  }

  socketToUser.delete(socketId);
  return undefined;
}

/**
 * Check if a user is online
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Get count of online users by role
 */
export function getOnlineCountByRole(): { admin: number; monitor: number; worker: number } {
  const counts = { admin: 0, monitor: 0, worker: 0 };
  
  onlineUsers.forEach((user) => {
    if (user.role === 'admin') counts.admin++;
    else if (user.role === 'monitor') counts.monitor++;
    else if (user.role === 'worker') counts.worker++;
  });

  return counts;
}

/**
 * Get all online users (for debugging/admin)
 */
export function getAllOnlineUsers(): OnlineUser[] {
  return Array.from(onlineUsers.values());
}

/**
 * Get online users by role
 */
export function getOnlineUsersByRole(role: string): OnlineUser[] {
  return Array.from(onlineUsers.values()).filter(user => user.role === role);
}

/**
 * Get total online count
 */
export function getTotalOnlineCount(): number {
  return onlineUsers.size;
}
