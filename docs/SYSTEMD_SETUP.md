# Systemd Service Setup Guide

This guide explains how to set up the Smart Factory Backend as a systemd service that loads environment variables from a `.env` file.

## Quick Setup

1. **Copy the service template:**
   ```bash
   cp smart-factory-backend.service /tmp/smart-factory-backend.service
   ```

2. **Edit the service file** and replace all placeholders:
   ```bash
   nano /tmp/smart-factory-backend.service
   ```
   
   Replace:
   - `your-user` → Your Linux username (e.g., `ubuntu`, `deploy`)
   - `your-group` → Your Linux group (usually same as username)
   - `/path/to/backend` → Full path to your backend directory (e.g., `/home/ubuntu/PM_BE`)

3. **Find your Node.js path:**
   ```bash
   which node
   # or
   which nodejs
   ```
   
   Update `ExecStart=` in the service file with the correct path.

4. **Ensure your `.env` file exists** and has the correct format:
   ```bash
   # Check if .env exists
   ls -la /path/to/backend/.env
   
   # View contents (be careful with secrets!)
   cat /path/to/backend/.env
   ```

5. **Set proper permissions** on `.env` file:
   ```bash
   chmod 600 /path/to/backend/.env
   chown your-user:your-group /path/to/backend/.env
   ```

6. **Install the service:**
   ```bash
   sudo cp /tmp/smart-factory-backend.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable smart-factory-backend
   sudo systemctl start smart-factory-backend
   ```

7. **Verify it's running:**
   ```bash
   sudo systemctl status smart-factory-backend
   ```

## Environment File Format

The `.env` file must follow this format for systemd to parse it correctly:

```
KEY=VALUE
```

**Important rules:**
- ❌ No quotes around values: `PORT="3000"` (wrong)
- ✅ No quotes: `PORT=3000` (correct)
- ❌ No spaces around `=`: `PORT = 3000` (wrong)
- ✅ No spaces: `PORT=3000` (correct)
- ✅ Comments are NOT supported in systemd EnvironmentFile
- ✅ Empty lines are ignored

**Example `.env` file:**
```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/smart_factory
JWT_SECRET=your-super-secret-jwt-key-change-this
BCRYPT_SALT_ROUNDS=12
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart_factory_backend
MQTT_USERNAME=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password
CLUSTER_WORKERS=4
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Using nvm with Systemd

If you're using nvm (Node Version Manager), systemd won't automatically load it. You have two options:

### Option 1: Use Full Node.js Path

Find your Node.js installation:
```bash
~/.nvm/versions/node/v18.20.8/bin/node --version
```

Update `ExecStart` in the service file:
```ini
ExecStart=/home/your-user/.nvm/versions/node/v18.20.8/bin/node /path/to/backend/dist/cluster.js
```

### Option 2: Create a Wrapper Script (Recommended)

Create a startup script at `/path/to/backend/start.sh`:

```bash
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /path/to/backend
exec node dist/cluster.js
```

Make it executable:
```bash
chmod +x /path/to/backend/start.sh
```

Update the service file:
```ini
ExecStart=/path/to/backend/start.sh
```

## Service Management Commands

```bash
# Start the service
sudo systemctl start smart-factory-backend

# Stop the service
sudo systemctl stop smart-factory-backend

# Restart the service
sudo systemctl restart smart-factory-backend

# Check status
sudo systemctl status smart-factory-backend

# View logs (live)
sudo journalctl -u smart-factory-backend -f

# View last 50 log lines
sudo journalctl -u smart-factory-backend -n 50

# View logs since today
sudo journalctl -u smart-factory-backend --since today

# Enable on boot
sudo systemctl enable smart-factory-backend

# Disable on boot
sudo systemctl disable smart-factory-backend
```

## Troubleshooting

### Service fails to start

1. **Check service status:**
   ```bash
   sudo systemctl status smart-factory-backend
   ```

2. **View detailed logs:**
   ```bash
   sudo journalctl -u smart-factory-backend -n 100
   ```

3. **Test manually as the service user:**
   ```bash
   sudo -u your-user bash
   cd /path/to/backend
   source .env  # Load environment variables
   node dist/cluster.js
   ```

### Environment variables not loading

1. **Verify `.env` file format:**
   ```bash
   # Check for common issues
   cat /path/to/backend/.env | grep -E '^[A-Z_]+='
   ```

2. **Check file permissions:**
   ```bash
   ls -la /path/to/backend/.env
   # Should show: -rw------- (600)
   ```

3. **Test environment loading:**
   ```bash
   sudo -u your-user cat /path/to/backend/.env
   ```

4. **Verify path in service file:**
   ```bash
   sudo cat /etc/systemd/system/smart-factory-backend.service | grep EnvironmentFile
   ```

### Permission denied errors

```bash
# Fix ownership
sudo chown -R your-user:your-group /path/to/backend

# Fix permissions
chmod 755 /path/to/backend
chmod 600 /path/to/backend/.env
chmod 755 /path/to/backend/dist
chmod 644 /path/to/backend/dist/cluster.js
```

### Node.js not found

```bash
# Find Node.js
which node
which nodejs

# Test as service user
sudo -u your-user which node

# If using nvm, use wrapper script approach (see above)
```

## Security Best Practices

1. **Protect `.env` file:**
   ```bash
   chmod 600 /path/to/backend/.env
   chown your-user:your-group /path/to/backend/.env
   ```

2. **Don't commit `.env` to git:**
   - Ensure `.env` is in `.gitignore`
   - Use `.env.example` as a template

3. **Use separate service user:**
   - Create a dedicated user for the service: `sudo adduser --system --group smartfactory`
   - Don't run as root

4. **Limit service capabilities:**
   - The service file includes `NoNewPrivileges=true` and `PrivateTmp=true`
   - Consider additional restrictions based on your security requirements

## Reloading Environment Variables

After changing `.env` file, restart the service:

```bash
sudo systemctl restart smart-factory-backend
```

Note: Systemd caches environment variables, so you must restart the service for changes to take effect.

