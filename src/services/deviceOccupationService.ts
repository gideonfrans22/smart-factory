import { createClient } from "redis";

/**
 * Device Occupation Service
 * Manages device occupation status in Redis cache
 * Prevents duplicate tablet setup for the same device
 */

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Redis client for device occupation tracking
 */
export const initializeDeviceOccupationService = async (): Promise<void> => {
  if (redisClient) {
    console.log("⚠️ Device occupation service already initialized");
    return;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    console.log("✅ Device occupation Redis client connected");
  } catch (error) {
    console.error("❌ Failed to connect Redis for device occupation:", error);
    // Continue without Redis - device occupation checks will fail gracefully
  }
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error("Redis client not connected");
  }
  return redisClient;
};

/**
 * Check if a device is currently occupied by a tablet
 * @param deviceId Device ID to check
 * @returns Object with isOccupied flag and socketId if occupied
 */
export const isDeviceOccupied = async (
  deviceId: string
): Promise<{ isOccupied: boolean; socketId?: string }> => {
  try {
    const client = getRedisClient();
    const key = `device:occupied:${deviceId}`;
    const value = await client.get(key);

    if (!value) {
      return { isOccupied: false };
    }

    // Value contains socketId and timestamp
    const data = JSON.parse(value);
    return {
      isOccupied: true,
      socketId: data.socketId
    };
  } catch (error) {
    console.error(
      `❌ Error checking device occupation for ${deviceId}:`,
      error
    );
    // If Redis fails, assume device is not occupied (fail open)
    return { isOccupied: false };
  }
};

/**
 * Mark a device as occupied by a tablet
 * @param deviceId Device ID
 * @param socketId WebSocket socket ID
 * @param ttlSeconds Time to live in seconds (default: 24 hours)
 */
export const setDeviceOccupied = async (
  deviceId: string,
  socketId: string,
  ttlSeconds: number = 86400 // 24 hours default
): Promise<void> => {
  try {
    const client = getRedisClient();
    const key = `device:occupied:${deviceId}`;
    const value = JSON.stringify({
      socketId,
      occupiedAt: new Date().toISOString()
    });

    await client.setEx(key, ttlSeconds, value);
    console.log(
      `✅ Device ${deviceId} marked as occupied by socket ${socketId}`
    );
  } catch (error) {
    console.error(`❌ Error setting device occupation for ${deviceId}:`, error);
    throw error;
  }
};

/**
 * Release a device (mark as not occupied)
 * @param deviceId Device ID
 */
export const releaseDevice = async (deviceId: string): Promise<void> => {
  try {
    const client = getRedisClient();
    const key = `device:occupied:${deviceId}`;
    await client.del(key);
    console.log(`✅ Device ${deviceId} released`);
  } catch (error) {
    console.error(`❌ Error releasing device ${deviceId}:`, error);
    // Don't throw - releasing is best effort
  }
};

/**
 * Release device by socket ID (useful when socket disconnects)
 * @param socketId WebSocket socket ID
 */
export const releaseDeviceBySocketId = async (
  socketId: string
): Promise<void> => {
  try {
    const client = getRedisClient();
    // Scan for keys matching the pattern
    const keys = await client.keys("device:occupied:*");

    for (const key of keys) {
      const value = await client.get(key);
      if (value) {
        const data = JSON.parse(value);
        if (data.socketId === socketId) {
          await client.del(key);
          const deviceId = key.replace("device:occupied:", "");
          console.log(
            `✅ Device ${deviceId} released (socket ${socketId} disconnected)`
          );
          return;
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error releasing device by socket ID ${socketId}:`, error);
    // Don't throw - releasing is best effort
  }
};

/**
 * Get all occupied devices (for admin/debugging)
 */
export const getAllOccupiedDevices = async (): Promise<
  Array<{ deviceId: string; socketId: string; occupiedAt: string }>
> => {
  try {
    const client = getRedisClient();
    const keys = await client.keys("device:occupied:*");
    const devices = [];

    for (const key of keys) {
      const value = await client.get(key);
      if (value) {
        const data = JSON.parse(value);
        const deviceId = key.replace("device:occupied:", "");
        devices.push({
          deviceId,
          socketId: data.socketId,
          occupiedAt: data.occupiedAt
        });
      }
    }

    return devices;
  } catch (error) {
    console.error("❌ Error getting all occupied devices:", error);
    return [];
  }
};
