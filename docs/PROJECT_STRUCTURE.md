# Smart Factory Backend - Project Structure

## 📁 Complete File Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB connection configuration
│   │   └── mqtt.ts              # MQTT broker configuration and service
│   ├── controllers/
│   │   └── authController.ts    # Authentication logic (login, register, profile)
│   ├── middleware/
│   │   └── auth.ts              # JWT authentication and authorization middleware
│   ├── models/
│   │   ├── index.ts             # Model exports
│   │   ├── User.ts              # User schema (managers and workers)
│   │   ├── ProcessLine.ts       # Process line configuration schema
│   │   ├── Part.ts              # Part/component schema
│   │   └── ProcessRecord.ts     # Processing history and status schema
│   ├── routes/
│   │   └── auth.ts              # Authentication routes
│   ├── services/
│   │   └── monitoringService.ts # Real-time monitoring and MQTT handling
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── utils/
│   │   ├── helpers.ts           # Utility functions (password hashing, JWT, etc.)
│   │   └── seed.ts              # Database seeding script
│   └── index.ts                 # Main application entry point
├── dist/                        # Compiled JavaScript files (generated)
├── node_modules/                # Dependencies
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── nodemon.json                 # Development server configuration
├── package.json                 # Project configuration and dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # Project documentation
```

## 🛠️ Technology Stack

### Core Technologies
- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web framework
- **MongoDB** - Primary database with Mongoose ODM
- **MQTT** - Real-time messaging protocol

### Security & Authentication
- **JWT (JSON Web Tokens)** - Authentication
- **bcryptjs** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - API rate limiting

### Development Tools
- **nodemon** - Hot reloading
- **ts-node** - Run TypeScript directly
- **dotenv** - Environment variable management

## 🏭 System Architecture

### User Roles
- **Manager**: Can configure process flows, assign parts, monitor all operations
- **Worker**: Can view assigned tasks, start/complete processing steps

### Core Features Implemented

#### 1. Authentication System ✅
- JWT-based authentication
- Role-based access control (Manager/Worker)
- Secure password hashing
- User profile management

#### 2. Database Models ✅
- **User**: Authentication and role management
- **ProcessLine**: Factory line configuration (1-20 lines)
- **Part**: Components requiring processing
- **ProcessRecord**: Processing history and status tracking

#### 3. Real-time MQTT Integration ✅
- MQTT broker connection
- Real-time worker action processing
- Process line status broadcasting
- Part progress tracking
- Manager command handling

#### 4. Monitoring Service ✅
- Real-time process line status
- Part progress tracking
- Production metrics calculation
- Worker action processing

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

### System
- `GET /` - API information
- `GET /api/health` - Health check with system status

## 📊 MQTT Topics

```typescript
PROCESS_LINE_STATUS: 'factory/process-line/status'    // Process line updates
PART_PROGRESS: 'factory/part/progress'               // Part movement updates  
WORKER_ACTION: 'factory/worker/action'               // Worker button actions
MANAGER_COMMAND: 'factory/manager/command'           // Manager assignments
SYSTEM_ALERTS: 'factory/system/alerts'              // System notifications
PRODUCTION_METRICS: 'factory/metrics/production'     // KPI updates
```

## 🔧 Environment Configuration

Required environment variables:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smart_factory

# Security
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_SALT_ROUNDS=12

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart_factory_backend

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🎯 Next Steps for Full Implementation

### Additional Controllers Needed
- **Part Controller** - CRUD operations for parts
- **Process Line Controller** - Process line management
- **Dashboard Controller** - Manager dashboard data
- **Worker Controller** - Worker task management
- **Analytics Controller** - Reporting and KPIs

### Additional Routes
- `/api/parts` - Part management
- `/api/process-lines` - Process line operations
- `/api/dashboard` - Manager dashboard
- `/api/worker` - Worker interface
- `/api/analytics` - Production reports

### Advanced Features to Implement
- **WebSocket Integration** - Real-time dashboard updates
- **File Upload** - Part specifications and documents
- **Notification System** - Email/SMS alerts
- **Advanced Analytics** - Performance metrics and reports
- **Backup System** - Data backup and recovery
- **API Documentation** - Swagger/OpenAPI documentation

## 🏃‍♂️ Quick Start Commands

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Seed database with initial data
npm run seed

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🧪 Testing the Setup

1. **Start MongoDB** (ensure MongoDB is running locally)
2. **Start MQTT Broker** (optional for basic testing)
3. **Run the seed script**: `npm run seed`
4. **Start the server**: `npm run dev`
5. **Test authentication**:
   - Register: `POST /api/auth/register`
   - Login: `POST /api/auth/login`
   - Use default users: `manager/manager123` or `worker1/worker123`

The backend is now ready for frontend integration and further feature development! 🎉
