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
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=your-user
Group=your-group
WorkingDirectory=/path/to/backend

# Load environment variables from .env file
# The '-' prefix means systemd won't fail if the file doesn't exist
EnvironmentFile=-/path/to/backend/.env

# Override or set specific environment variables if needed
# These will take precedence over values in .env file
Environment=NODE_ENV=production

# Path to Node.js executable (adjust if using nvm or different path)
# To find your Node.js path: which node
ExecStart=/usr/bin/node /path/to/backend/dist/cluster.js

# Restart policy
Restart=always
RestartSec=10

# Resource limits (optional, adjust based on your needs)
LimitNOFILE=65536
MemoryLimit=2G

# Security settings
NoNewPrivileges=true
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smart-factory-backend

# Graceful shutdown timeout (in seconds)
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

**Important Notes:**

1. **Replace placeholders:**

   - `your-user` - The user account that will run the service (e.g., `ubuntu`, `deploy`)
   - `your-group` - The group for the user (usually same as username)
   - `/path/to/backend` - Full path to your backend directory (e.g., `/home/ubuntu/PM_BE`)

2. **Node.js path:**

   - Find your Node.js executable: `which node` or `which nodejs`
   - If using nvm, you may need to use the full path: `/home/your-user/.nvm/versions/node/v18.20.8/bin/node`
   - Or create a wrapper script that loads nvm first

3. **Environment file format:**

   - The `.env` file should be in standard format: `KEY=VALUE` (no quotes, no spaces around `=`)
   - Example:
     ```
     PORT=3000
     MONGODB_URI=mongodb://localhost:27017/smart_factory
     JWT_SECRET=your-secret-key
     MQTT_BROKER_URL=mqtt://localhost:1883
     CLUSTER_WORKERS=4
     ```

4. **File permissions:**

   - Ensure `.env` file has proper permissions (not world-readable if it contains secrets):
     ```bash
     chmod 600 /path/to/backend/.env
     chown your-user:your-group /path/to/backend/.env
     ```

5. **Using nvm with systemd:**
   If you're using nvm, create a wrapper script at `/path/to/backend/start.sh`:
   ```bash
   #!/bin/bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   cd /path/to/backend
   node dist/cluster.js
   ```
   Then make it executable: `chmod +x /path/to/backend/start.sh`
   And update ExecStart in the service file:
   ```ini
   ExecStart=/path/to/backend/start.sh
   ```

Then enable and start the service:

```bash
# Copy the service file (adjust paths first!)
sudo cp smart-factory-backend.service /etc/systemd/system/

# Or create it directly
sudo nano /etc/systemd/system/smart-factory-backend.service

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable smart-factory-backend

# Start the service
sudo systemctl start smart-factory-backend

# Check status
sudo systemctl status smart-factory-backend

# View logs
sudo journalctl -u smart-factory-backend -f
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

### Systemd Service Issues

**Service won't start:**

```bash
# Check service status
sudo systemctl status smart-factory-backend

# View detailed logs
sudo journalctl -u smart-factory-backend -n 50

# Check if .env file exists and is readable
sudo -u your-user cat /path/to/backend/.env

# Verify Node.js path
which node
```

**Environment variables not loading:**

- Ensure `.env` file format is correct: `KEY=VALUE` (no quotes, no spaces)
- Check file permissions: `ls -la /path/to/backend/.env`
- Verify the path in `EnvironmentFile=` matches actual file location
- Check if variables are being overridden by `Environment=` directives

**Permission denied errors:**

- Ensure the service user owns the backend directory:
  ```bash
  sudo chown -R your-user:your-group /path/to/backend
  ```
- Check file permissions on `dist/cluster.js`:
  ```bash
  ls -la /path/to/backend/dist/cluster.js
  ```

**Node.js not found:**

- If using nvm, use the wrapper script approach mentioned above
- Or set the full path to Node.js in `ExecStart`
- Verify Node.js is accessible: `sudo -u your-user which node`

## Migration from PM2

If you were previously using PM2:

1. Remove PM2 process: `pm2 delete PM_BE`
2. Update deployment scripts to use `npm start` instead of `pm2 reload`
3. Set up systemd service or another process manager for the master process
4. Configure `CLUSTER_WORKERS` environment variable if needed
