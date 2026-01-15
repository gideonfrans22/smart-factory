# Smart Factory Backend

A Node.js backend API built with TypeScript and Express.js for the Smart Factory project.

## Features

- ✅ TypeScript for type safety
- ✅ Express.js web framework
- ✅ Node.js Cluster Module for multi-worker process management
- ✅ Hot reloading with nodemon
- ✅ Source maps for debugging
- ✅ Strict TypeScript configuration
- ✅ Environment variable support

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload (single process)
- `npm run dev:cluster` - Start development server with cluster mode
- `npm run build` - Build the project for production
- `npm run start` - Start the production server with cluster (spawns multiple workers)
- `npm run start:single` - Start production server as single process (no cluster)
- `npm run scheduler` - Start report scheduler worker (development)
- `npm run scheduler:prod` - Start report scheduler worker (production)
- `npm run build:watch` - Build the project in watch mode
- `npm run clean` - Remove the dist folder

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check endpoint

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Worker process entry point
│   ├── cluster.ts            # Cluster master process
│   ├── config/               # Database & MQTT configuration
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Authentication & file upload
│   ├── models/               # MongoDB schemas
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Helper functions & seed data
├── docs/
│   ├── CLUSTER_SETUP.md      # Cluster module setup guide
│   ├── MONGODB_SCHEMA.md     # Complete database schema
│   ├── RAW_MATERIAL_IMPLEMENTATION.md  # Raw material system
│   ├── TASK_FLOW_ARCHITECTURE.md       # Task workflow
│   ├── API_IMPLEMENTATION_COMPLETE.md  # Implementation status
│   └── legacy/               # Outdated documentation (archived)
├── uploads/                  # File uploads directory
├── dist/                     # Compiled JavaScript files
├── .env.example              # Environment variables template
├── package.json              # Project dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## Documentation

📚 **Current Documentation** (in `docs/`):

- **[CLUSTER_SETUP.md](docs/CLUSTER_SETUP.md)** - Node.js Cluster Module setup and configuration
- **[MONGODB_SCHEMA.md](docs/MONGODB_SCHEMA.md)** - Complete database schema with all 14 collections
- **[RAW_MATERIAL_IMPLEMENTATION.md](docs/RAW_MATERIAL_IMPLEMENTATION.md)** - Raw material management system
- **[TASK_FLOW_ARCHITECTURE.md](docs/TASK_FLOW_ARCHITECTURE.md)** - Task workflow and recipe integration
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Project organization details
- **[API_IMPLEMENTATION_COMPLETE.md](docs/API_IMPLEMENTATION_COMPLETE.md)** - API implementation status

⚠️ **Legacy Documentation** (in `docs/legacy/`):
Archived documentation from previous versions - contains outdated field names and structures. See `docs/legacy/README.md` for details.

## Report Scheduler

The system includes an automated report scheduler that generates reports on a periodic basis. The scheduler runs automatically in the master process when using cluster mode.

### Scheduled Reports

- **Daily (02:00 every day)**: WORKER_PERFORMANCE_KPI
- **Weekly (02:00 every Monday)**: PRODUCTION_RATE, EQUIPMENT_PERFORMANCE, WORKER_PERFORMANCE_KPI
- **Monthly (02:00 on 1st of month)**: PRODUCTION_RATE, EQUIPMENT_PERFORMANCE, WORKER_PERFORMANCE_KPI

### Running the Scheduler

The scheduler is automatically initialized when running in cluster mode (`npm run dev:cluster` or `npm run start`). It runs in the master process alongside the API workers.

For standalone scheduler (if needed for testing or separate deployment):

```bash
# Development
npm run scheduler

# Production (after build)
npm run scheduler:prod
```

### Environment Variables

Add these to your `.env` file:

```env
# Report Scheduler Configuration
ENABLE_SCHEDULER=true              # Enable/disable scheduler (default: true)
SCHEDULER_TIMEZONE=Asia/Seoul       # Timezone for scheduling (default: Asia/Seoul)
SCHEDULER_RETRY_ATTEMPTS=3         # Number of retry attempts on failure (default: 3)
```

### Deployment

When using cluster mode, the scheduler runs automatically in the master process. No separate process is needed. The scheduler will start automatically when you run:

```bash
npm run start  # Production cluster mode
```

Or with PM2:
```bash
pm2 start dist/cluster.js --name "smart-factory-api"
```

The scheduler runs in the same process as the cluster master, ensuring only one instance runs even with multiple API workers.

## Development

The project uses TypeScript with strict type checking enabled. All source code should be placed in the `src/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request
