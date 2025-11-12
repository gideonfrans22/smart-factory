import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
// import jwt from "jsonwebtoken";

let io: SocketIOServer;

/**
 * Initialize Socket.IO server for real-time communication
 * Provides WebSocket connections for frontend dashboards
 */
export const initializeWebSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    path: "/ws",
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

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

    // Join device-specific room
    socket.on("join:device", (deviceId: string) => {
      if (!deviceId) return;
      socket.join(`device:${deviceId}`);
      console.log(`🤖 Socket ${socket.id} joined device room: ${deviceId}`);
      socket.emit("joined", { room: "device", id: deviceId });
    });

    // Leave device room
    socket.on("leave:device", (deviceId: string) => {
      if (!deviceId) return;
      socket.leave(`device:${deviceId}`);
      console.log(`🤖 Socket ${socket.id} left device room: ${deviceId}`);
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

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      console.log(
        `❌ WebSocket client disconnected: ${socket.id} - Reason: ${reason}`
      );
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
