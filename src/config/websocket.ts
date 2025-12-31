import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import {
  initializeDeviceOccupationService,
  isDeviceOccupied,
  setDeviceOccupied,
  releaseDevice,
  releaseDeviceBySocketId
} from "../services/deviceOccupationService";
// import jwt from "jsonwebtoken";

let io: SocketIOServer;

/**
 * Initialize Socket.IO server for real-time communication
 * Provides WebSocket connections for frontend dashboards
 */
export const initializeWebSocket = async (
  httpServer: HTTPServer
): Promise<SocketIOServer> => {
  io = new SocketIOServer(httpServer, {
    path: "/ws",
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Add Redis adapter for multi-worker support
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));

    console.log("✅ Socket.IO Redis adapter connected");
  } catch (error) {
    console.error("❌ Redis adapter connection failed:", error);
    console.warn(
      "⚠️ Running Socket.IO without Redis adapter (single worker mode recommended)"
    );
  }

  // Initialize device occupation service
  try {
    await initializeDeviceOccupationService();
  } catch (error) {
    console.error("❌ Failed to initialize device occupation service:", error);
    console.warn("⚠️ Device occupation checks will be disabled");
  }

  // Authentication middleware (currently disabled to match REST API auth state)
  io.use((socket: Socket, next) => {
    console.log(`🔌 WebSocket client attempting connection: ${socket.id}`);

    // ⚠️ Authentication temporarily disabled (matches auth.ts middleware)
    // When re-enabling auth, uncomment the block below
    next();

    /*
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('❌ WebSocket auth failed: No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.data.user = decoded;
      console.log(`✅ WebSocket authenticated: ${decoded.userId}`);
      next();
    } catch (error) {
      console.log('❌ WebSocket auth failed: Invalid token');
      return next(new Error('Invalid token'));
    }
    */
  });

  // Connection handler
  io.on("connection", (socket: Socket) => {
    console.log(`✅ WebSocket client connected: ${socket.id}`);

    // Auto-join global room for system-wide broadcasts
    socket.join("global");

    // --- Room Management ---

    // Join project-specific room
    socket.on("join:project", (projectId: string) => {
      if (!projectId) return;
      socket.join(`project:${projectId}`);
      console.log(`📂 Socket ${socket.id} joined project room: ${projectId}`);
      socket.emit("joined", { room: "project", id: projectId });
    });

    // Leave project room
    socket.on("leave:project", (projectId: string) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
      console.log(`📂 Socket ${socket.id} left project room: ${projectId}`);
    });

    // Join device-specific room (with occupation check)
    socket.on("join:device", async (deviceId: string) => {
      if (!deviceId) {
        socket.emit("device:join:error", { message: "Device ID is required" });
        return;
      }

      try {
        // Check if device is already occupied
        const occupation = await isDeviceOccupied(deviceId);
        if (occupation.isOccupied && occupation.socketId !== socket.id) {
          // Device is occupied by another tablet
          console.log(
            `⚠️ Device ${deviceId} is already occupied by socket ${occupation.socketId}, rejecting socket ${socket.id}`
          );
          socket.emit("device:join:error", {
            message: "Device is already in use by another tablet",
            deviceId,
            occupiedBy: occupation.socketId
          });
          return;
        }

        // Mark device as occupied by this socket
        await setDeviceOccupied(deviceId, socket.id);
        socket.data.deviceId = deviceId; // Store deviceId in socket data for cleanup

        // Join the device room
        socket.join(`device:${deviceId}`);
        console.log(`🤖 Socket ${socket.id} joined device room: ${deviceId}`);
        socket.emit("joined", { room: "device", id: deviceId });
        socket.emit("device:join:success", { deviceId });
      } catch (error) {
        console.error(`❌ Error joining device room ${deviceId}:`, error);
        socket.emit("device:join:error", {
          message: "Failed to join device room",
          deviceId
        });
      }
    });

    // Leave device room (and release occupation)
    socket.on("leave:device", async (deviceId: string) => {
      if (!deviceId) return;

      try {
        // Release device occupation
        await releaseDevice(deviceId);
        socket.leave(`device:${deviceId}`);
        delete socket.data.deviceId;
        console.log(`🤖 Socket ${socket.id} left device room: ${deviceId}`);
      } catch (error) {
        console.error(`❌ Error leaving device room ${deviceId}:`, error);
        // Still leave the room even if release fails
        socket.leave(`device:${deviceId}`);
        delete socket.data.deviceId;
      }
    });

    // Join task-specific room
    socket.on("join:task", (taskId: string) => {
      if (!taskId) return;
      socket.join(`task:${taskId}`);
      console.log(`📋 Socket ${socket.id} joined task room: ${taskId}`);
      socket.emit("joined", { room: "task", id: taskId });
    });

    // Leave task room
    socket.on("leave:task", (taskId: string) => {
      if (!taskId) return;
      socket.leave(`task:${taskId}`);
      console.log(`📋 Socket ${socket.id} left task room: ${taskId}`);
    });

    // Join deviceType-specific room (for workers monitoring specific device types)
    socket.on("join:devicetype", (deviceTypeId: string) => {
      if (!deviceTypeId) return;
      socket.join(`devicetype:${deviceTypeId}`);
      console.log(
        `🔧 Socket ${socket.id} joined deviceType room: ${deviceTypeId}`
      );
      socket.emit("joined", { room: "devicetype", id: deviceTypeId });
    });

    // Leave deviceType room
    socket.on("leave:devicetype", (deviceTypeId: string) => {
      if (!deviceTypeId) return;
      socket.leave(`devicetype:${deviceTypeId}`);
      console.log(
        `🔧 Socket ${socket.id} left deviceType room: ${deviceTypeId}`
      );
    });

    // Join alerts room (for managers/supervisors)
    socket.on("join:alerts", () => {
      socket.join("alerts");
      console.log(`🚨 Socket ${socket.id} joined alerts room`);
      socket.emit("joined", { room: "alerts" });
    });

    // Leave alerts room
    socket.on("leave:alerts", () => {
      socket.leave("alerts");
      console.log(`🚨 Socket ${socket.id} left alerts room`);
    });

    // Join KPIs room (for analytics dashboards)
    socket.on("join:kpis", () => {
      socket.join("kpis");
      console.log(`📊 Socket ${socket.id} joined KPIs room`);
      socket.emit("joined", { room: "kpis" });
    });

    // Leave KPIs room
    socket.on("leave:kpis", () => {
      socket.leave("kpis");
      console.log(`📊 Socket ${socket.id} left KPIs room`);
    });

    // Join monitors room (for Monitor TV displays)
    socket.on("join:monitors", () => {
      socket.join("monitors");
      console.log(`📺 Socket ${socket.id} joined monitors room`);
      socket.emit("joined", { room: "monitors" });
    });

    // Leave monitors room
    socket.on("leave:monitors", () => {
      socket.leave("monitors");
      console.log(`📺 Socket ${socket.id} left monitors room`);
    });

    // Join user-specific room (for personal notifications)
    socket.on("join:user", (userId: string) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      console.log(`👤 Socket ${socket.id} joined user room: ${userId}`);
      socket.emit("joined", { room: "user", id: userId });
    });

    // Ping/pong for connection health check
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Disconnect handler (release device occupation)
    socket.on("disconnect", async (reason) => {
      console.log(
        `❌ WebSocket client disconnected: ${socket.id} - Reason: ${reason}`
      );

      // Release device occupation if socket was connected to a device
      if (socket.data.deviceId) {
        try {
          await releaseDevice(socket.data.deviceId);
          console.log(
            `✅ Released device ${socket.data.deviceId} on disconnect`
          );
        } catch (error) {
          console.error(
            `❌ Error releasing device ${socket.data.deviceId} on disconnect:`,
            error
          );
        }
      } else {
        // Fallback: try to release by socket ID (in case deviceId wasn't stored)
        try {
          await releaseDeviceBySocketId(socket.id);
        } catch (error) {
          // Ignore errors - this is best effort cleanup
        }
      }
    });

    // Error handler
    socket.on("error", (error) => {
      console.error(`⚠️ WebSocket error from ${socket.id}:`, error);
    });
  });

  console.log("🔌 WebSocket server initialized");
  return io;
};

/**
 * Get the Socket.IO server instance
 * Use this to emit events from controllers/services
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error(
      "Socket.IO not initialized. Call initializeWebSocket first."
    );
  }
  return io;
};

export { io };
