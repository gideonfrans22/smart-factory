import * as express from 'express';
import { Request, Response } from 'express';
import * as cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import configurations
import { connectDB } from './config/database';
import { mqttService } from './config/mqtt';

// Import routes
import authRoutes from './routes/auth';

// Import services
import { monitoringService } from './services/monitoringService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100') // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);

// Health check and info routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Smart Factory Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: [
      'User Authentication (JWT)',
      'Process Management',
      'Real-time MQTT Monitoring',
      'MongoDB Database',
      'Production Analytics'
    ]
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    mqtt: mqttService.isConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Global error handler
app.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Global error handler:', error);
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Initialize services and start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Connect to MQTT broker
    await mqttService.connect();
    
    // Initialize monitoring service
    await monitoringService.initializeMonitoring();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log('🚀 Smart Factory Backend Server Started');
      console.log(`📱 API available at http://localhost:${PORT}`);
      console.log(`🏭 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('✅ All services initialized successfully');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📤 SIGTERM received, shutting down gracefully...');
  mqttService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📤 SIGINT received, shutting down gracefully...');
  mqttService.disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
