# Node.js Cluster Module Setup

This application uses Node.js Cluster Module for process management instead of PM2. The cluster module spawns multiple worker processes to handle incoming requests, improving performance and reliability.

## How It Works

- **Master Process**: Spawns and manages worker processes
- **Worker Processes**: Handle HTTP requests and WebSocket connections
- **Automatic Restart**: Workers that crash are automatically restarted
- **Graceful Shutdown**: Both master and workers handle shutdown signals properly

## Configuration

### Number of Workers

By default, the cluster spawns one worker per CPU core. You can override this by setting the `CLUSTER_WORKERS` environment variable:

```bash
# Use 4 workers
CLUSTER_WORKERS=4 npm start

# Use all CPU cores (default)
npm start
```

### Environment Variables

- `CLUSTER_WORKERS`: Number of worker processes to spawn (default: number of CPU cores)
- `PORT`: Port for the server to listen on (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Running the Application

### Development

```bash
# Single process (no cluster)
npm run dev

# With cluster (for testing)
npm run dev:cluster
```

### Production

```bash
# Build the project
npm run build

# Start with cluster (spawns workers)
npm start

# Start single process (no cluster)
npm run start:single
```

## Production Deployment

### Option 1: Systemd Service (Recommended)

Create a systemd service file at `/etc/systemd/system/smart-factory-backend.service`:

```ini
[Unit]
Description=Smart Factory Backend API
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
Environment=CLUSTER_WORKERS=4
ExecStart=/usr/bin/node /path/to/backend/dist/cluster.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=smart-factory-backend

[Install]
WantedBy=multi-user.target
```

Then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smart-factory-backend
sudo systemctl start smart-factory-backend
sudo systemctl status smart-factory-backend
```

### Option 2: Process Manager Script

Create a simple start script that handles restarts:

```bash
#!/bin/bash
cd /path/to/backend
pkill -f "node dist/cluster.js" || true
sleep 2
nohup npm start > app.log 2>&1 &
```

### Option 3: Using PM2 (Optional)

If you still want to use PM2 to manage the master process (the cluster module handles workers internally):

```bash
pm2 start dist/cluster.js --name smart-factory-backend
```

Note: This is optional since the cluster module already handles multiple processes.

## Monitoring

### Check Worker Status

The master process logs worker spawn/exit events. Check your logs to see:

```
🔄 Master process 12345 is running
👷 Spawning 4 worker(s)...
✅ Worker 1 (PID: 12346) spawned
✅ Worker 2 (PID: 12347) spawned
...
```

### Health Check

The application provides a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

## WebSocket Support

The cluster module uses round-robin load balancing by default. For WebSocket connections, Socket.IO handles session affinity automatically. If you need sticky sessions, consider:

1. Using Socket.IO Redis adapter for multi-server setups
2. Configuring a reverse proxy (nginx) with IP hash for sticky sessions

## Troubleshooting

### Workers Keep Restarting

Check logs for errors. Common issues:
- Database connection failures
- Port already in use
- Memory issues

### Port Already in Use

Make sure only one master process is running:

```bash
# Find and kill existing processes
pkill -f "node dist/cluster.js"
```

### Performance Issues

- Adjust `CLUSTER_WORKERS` based on your server's CPU cores
- Monitor memory usage per worker
- Consider using fewer workers if memory is constrained

## Migration from PM2

If you were previously using PM2:

1. Remove PM2 process: `pm2 delete PM_BE`
2. Update deployment scripts to use `npm start` instead of `pm2 reload`
3. Set up systemd service or another process manager for the master process
4. Configure `CLUSTER_WORKERS` environment variable if needed

