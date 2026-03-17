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
} from "../../services/deviceOccupationService";
import {
  initializeUserOnlineService,
  registerUserOnline,
  unregisterUserOnline,
  getOnlineCountByRole,
  loggerService
} from "@shared/services";
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

    loggerService.logWebSocketEvent("Redis adapter connected");
  } catch (error) {
    loggerService.logWebSocketEvent(
      "Redis adapter connection failed",
      undefined,
      { error: (error as Error).message }
    );
    loggerService.warn(
      "Running Socket.IO without Redis adapter (single worker mode recommended)"
    );
  }

  // Initialize device occupation service
  try {
    await initializeDeviceOccupationService();
  } catch (error) {
    loggerService.logWebSocketEvent(
      "Failed to initialize device occupation service",
      undefined,
      { error: (error as Error).message }
    );
    loggerService.warn("Device occupation checks will be disabled");
  }

  // Initialize user online tracking service
  try {
    await initializeUserOnlineService();
  } catch (error) {
    loggerService.logWebSocketEvent(
      "Failed to initialize user online service",
      undefined,
      { error: (error as Error).message }
    );
    loggerService.warn("Using in-memory fallback for online user tracking");
  }

  // Authentication middleware (currently disabled to match REST API auth state)
  io.use((socket: Socket, next) => {
    loggerService.logWebSocketEvent("Client attempting connection", socket.id);

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
    loggerService.logWebSocketEvent("Client connected", socket.id);

    // Auto-join global room for system-wide broadcasts
    socket.join("global");

    // --- Room Management ---

    // Join project-specific room
    socket.on("join:project", (projectId: string) => {
      if (!projectId) return;
      socket.join(`project:${projectId}`);
      loggerService.logWebSocketEvent("Joined project room", socket.id, {
        projectId
      });
      socket.emit("joined", { room: "project", id: projectId });
    });

    // Leave project room
    socket.on("leave:project", (projectId: string) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
      loggerService.logWebSocketEvent("Left project room", socket.id, {
        projectId
      });
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
          loggerService.warn(
            `Device ${deviceId} is already occupied by socket ${occupation.socketId}, rejecting socket ${socket.id}`,
            {
              deviceId,
              occupiedBy: occupation.socketId,
              attemptingSocket: socket.id
            }
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
        loggerService.logWebSocketEvent("Joined device room", socket.id, {
          deviceId
        });
        socket.emit("joined", { room: "device", id: deviceId });
        socket.emit("device:join:success", { deviceId });
      } catch (error) {
        loggerService.logWebSocketEvent(
          "Error joining device room",
          socket.id,
          { deviceId, error: (error as Error).message }
        );
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
        loggerService.logWebSocketEvent("Left device room", socket.id, {
          deviceId
        });
      } catch (error) {
        loggerService.logWebSocketEvent(
          "Error leaving device room",
          socket.id,
          { deviceId, error: (error as Error).message }
        );
        // Still leave the room even if release fails
        socket.leave(`device:${deviceId}`);
        delete socket.data.deviceId;
      }
    });

    // Join task-specific room
    socket.on("join:task", (taskId: string) => {
      if (!taskId) return;
      socket.join(`task:${taskId}`);
      loggerService.logWebSocketEvent("Joined task room", socket.id, {
        taskId
      });
      socket.emit("joined", { room: "task", id: taskId });
    });

    // Leave task room
    socket.on("leave:task", (taskId: string) => {
      if (!taskId) return;
      socket.leave(`task:${taskId}`);
      loggerService.logWebSocketEvent("Left task room", socket.id, { taskId });
    });

    // Join deviceType-specific room (for workers monitoring specific device types)
    socket.on("join:devicetype", (deviceTypeId: string) => {
      if (!deviceTypeId) return;
      socket.join(`devicetype:${deviceTypeId}`);
      loggerService.logWebSocketEvent("Joined deviceType room", socket.id, {
        deviceTypeId
      });
      socket.emit("joined", { room: "devicetype", id: deviceTypeId });
    });

    // Leave deviceType room
    socket.on("leave:devicetype", (deviceTypeId: string) => {
      if (!deviceTypeId) return;
      socket.leave(`devicetype:${deviceTypeId}`);
      loggerService.logWebSocketEvent("Left deviceType room", socket.id, {
        deviceTypeId
      });
    });

    // Join alerts room (for managers/supervisors)
    socket.on("join:alerts", () => {
      socket.join("alerts");
      loggerService.logWebSocketEvent("Joined alerts room", socket.id);
      socket.emit("joined", { room: "alerts" });
    });

    // Leave alerts room
    socket.on("leave:alerts", () => {
      socket.leave("alerts");
      loggerService.logWebSocketEvent("Left alerts room", socket.id);
    });

    // Join KPIs room (for analytics dashboards)
    socket.on("join:kpis", () => {
      socket.join("kpis");
      loggerService.logWebSocketEvent("Joined KPIs room", socket.id);
      socket.emit("joined", { room: "kpis" });
    });

    // Leave KPIs room
    socket.on("leave:kpis", () => {
      socket.leave("kpis");
      loggerService.logWebSocketEvent("Left KPIs room", socket.id);
    });

    // Join monitors room (for Monitor TV displays)
    socket.on("join:monitors", () => {
      socket.join("monitors");
      loggerService.logWebSocketEvent("Joined monitors room", socket.id);
      socket.emit("joined", { room: "monitors" });
    });

    // Leave monitors room
    socket.on("leave:monitors", () => {
      socket.leave("monitors");
      loggerService.logWebSocketEvent("Left monitors room", socket.id);
    });

    // Join user-specific room (for personal notifications)
    socket.on("join:user", (userId: string) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      loggerService.logWebSocketEvent("Joined user room", socket.id, {
        userId
      });
      socket.emit("joined", { room: "user", id: userId });
    });

    // Register user as online (called after successful login)
    socket.on(
      "user:register",
      async (data: { userId: string; role: string; name: string }) => {
        if (!data.userId || !data.role || !data.name) {
          loggerService.warn(
            `Invalid user:register data from socket ${socket.id}`,
            { socketId: socket.id }
          );
          return;
        }

        await registerUserOnline(socket.id, data.userId, data.role, data.name);
        socket.data.userId = data.userId;
        socket.data.userRole = data.role;
        socket.data.userName = data.name;

        // Broadcast updated counts to admin dashboards
        const counts = await getOnlineCountByRole();
        io.to("global").emit("users:online:updated", counts);

        socket.emit("user:registered", { success: true });
      }
    );

    // Ping/pong for connection health check
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Disconnect handler (release device occupation and user online status)
    socket.on("disconnect", async (reason) => {
      loggerService.logWebSocketEvent("Client disconnected", socket.id, {
        reason
      });

      // Unregister user online status
      const disconnectedUser = await unregisterUserOnline(socket.id);
      if (disconnectedUser) {
        // Broadcast updated counts to admin dashboards
        const counts = await getOnlineCountByRole();
        io.to("global").emit("users:online:updated", counts);
      }

      // Release device occupation if socket was connected to a device
      if (socket.data.deviceId) {
        try {
          await releaseDevice(socket.data.deviceId);
          loggerService.logWebSocketEvent(
            "Released device on disconnect",
            socket.id,
            { deviceId: socket.data.deviceId }
          );
        } catch (error) {
          loggerService.logWebSocketEvent(
            "Error releasing device on disconnect",
            socket.id,
            {
              deviceId: socket.data.deviceId,
              error: (error as Error).message
            }
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
      loggerService.logWebSocketEvent("Error", socket.id, {
        error: (error as Error).message
      });
    });
  });

  loggerService.logWebSocketEvent("WebSocket server initialized");
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
