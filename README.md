# Smart Factory Backend

A Node.js backend API built with TypeScript and Express.js for the Smart Factory project.

## Features

- ✅ TypeScript for type safety
- ✅ Express.js web framework
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

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm run start` - Start the production server
- `npm run build:watch` - Build the project in watch mode
- `npm run clean` - Remove the dist folder

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check endpoint

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main application file
│   ├── config/               # Database & MQTT configuration
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Authentication & file upload
│   ├── models/               # MongoDB schemas
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Helper functions & seed data
├── docs/
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

- **[MONGODB_SCHEMA.md](docs/MONGODB_SCHEMA.md)** - Complete database schema with all 14 collections
- **[RAW_MATERIAL_IMPLEMENTATION.md](docs/RAW_MATERIAL_IMPLEMENTATION.md)** - Raw material management system
- **[TASK_FLOW_ARCHITECTURE.md](docs/TASK_FLOW_ARCHITECTURE.md)** - Task workflow and recipe integration
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Project organization details
- **[API_IMPLEMENTATION_COMPLETE.md](docs/API_IMPLEMENTATION_COMPLETE.md)** - API implementation status

⚠️ **Legacy Documentation** (in `docs/legacy/`):
Archived documentation from previous versions - contains outdated field names and structures. See `docs/legacy/README.md` for details.

## Development

The project uses TypeScript with strict type checking enabled. All source code should be placed in the `src/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request
