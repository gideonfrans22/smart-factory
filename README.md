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
│   └── index.ts          # Main application file
├── dist/                 # Compiled JavaScript files
├── node_modules/         # Dependencies
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore file
├── nodemon.json         # Nodemon configuration
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Development

The project uses TypeScript with strict type checking enabled. All source code should be placed in the `src/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request
