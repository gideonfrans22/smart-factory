#!/usr/bin/env node

/**
 * Interactive WebSocket Test Client
 * 
 * Interactive terminal UI for testing WebSocket functionality
 * Perfect for manual testing and debugging
 * 
 * Usage:
 *   node test-websocket-interactive.js [url]
 * 
 * Commands (type and press Enter):
 *   connect              - Connect to server
 *   disconnect           - Disconnect from server
 *   join:project <id>    - Join project room
 *   join:device <id>     - Join device room
 *   join:task <id>       - Join task room
 *   join:devicetype <id> - Join device type room
 *   join:user <id>       - Join user room
 *   join:alerts          - Join alerts room
 *   join:kpis            - Join KPIs room
 *   leave <room-name>    - Leave a room
 *   ping                 - Send ping (get pong response)
 *   emit <event> <data>  - Send custom event
 *   rooms                - List joined rooms
 *   status               - Show connection status
 *   clear                - Clear screen
 *   help                 - Show this help
 *   exit                 - Exit program
 */

const io = require('socket.io-client');
const readline = require('readline');

// Configuration
const serverUrl = process.argv[2] || 'http://localhost:3000';
let socket = null;

// Terminal setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Utility functions
const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
    debug: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`),
    event: (event, data) => console.log(`${colors.cyan}📨${colors.reset} Event: ${colors.magenta}${event}${colors.reset} → ${JSON.stringify(data)}`),
    command: (cmd) => console.log(`${colors.yellow}→${colors.reset}  ${cmd}`),
    title: (title) => console.log(`\n${colors.bright}${colors.cyan}${title}${colors.reset}`)
};

// ASCII art banner
function showBanner() {
    console.clear();
    console.log(`
${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.cyan}║                                                        ║${colors.reset}
${colors.bright}${colors.cyan}║        🔌 WebSocket Interactive Test Client 🔌          ║${colors.reset}
${colors.bright}${colors.cyan}║                   Smart Factory Backend                 ║${colors.reset}
${colors.bright}${colors.cyan}║                                                        ║${colors.reset}
${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}
  `);
    log.info(`Server: ${serverUrl}`);
    log.info(`Type 'help' for available commands`);
    console.log('');
}

// Command handlers
const commands = {
    connect: () => {
        if (socket?.connected) {
            log.warn('Already connected');
            return;
        }
        log.command('Connecting to server...');
        createConnection();
    },

    disconnect: () => {
        if (!socket?.connected) {
            log.warn('Not connected');
            return;
        }
        log.command('Disconnecting from server...');
        socket.disconnect();
    },

    ping: () => {
        if (!socket?.connected) {
            log.error('Not connected to server');
            return;
        }
        log.command('Sending ping...');
        socket.once('pong', () => {
            log.success('Pong received!');
        });
        socket.emit('ping');
    },

    rooms: () => {
        if (!socket) {
            log.error('Not connected');
            return;
        }
        const rooms = Object.keys(socket.rooms || {});
        if (rooms.length === 0) {
            log.info('Not in any rooms');
        } else {
            log.info(`Rooms (${rooms.length}):`);
            rooms.forEach(room => {
                console.log(`  ${colors.cyan}•${colors.reset} ${room}`);
            });
        }
    },

    status: () => {
        if (!socket) {
            log.error('Socket not initialized');
            return;
        }
        console.log('');
        log.title('Connection Status');
        console.log(`  Connected:  ${socket.connected ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset}`);
        console.log(`  Socket ID:  ${socket.id || 'N/A'}`);
        console.log(`  Server:     ${serverUrl}`);
        const rooms = Object.keys(socket.rooms || {});
        console.log(`  Rooms:      ${rooms.length}`);
        console.log('');
    },

    clear: () => {
        console.clear();
        showBanner();
    },

    help: () => {
        console.log('');
        log.title('Available Commands');
        console.log(`
  ${colors.bright}Connection:${colors.reset}
    connect              - Connect to server
    disconnect           - Disconnect from server
    status               - Show connection status

  ${colors.bright}Room Management:${colors.reset}
    join:project <id>    - Join project room
    join:device <id>     - Join device room
    join:task <id>       - Join task room
    join:devicetype <id> - Join device type room
    join:user <id>       - Join user room
    join:alerts          - Join alerts room
    join:kpis            - Join KPIs room
    leave <room-name>    - Leave a room
    rooms                - List joined rooms

  ${colors.bright}Events:${colors.reset}
    ping                 - Send ping (get pong)
    emit <event> <data>  - Send custom event

  ${colors.bright}Utility:${colors.reset}
    clear                - Clear screen
    help                 - Show this help
    exit                 - Exit program
    `);
    },

    exit: () => {
        log.info('Exiting...');
        if (socket) socket.disconnect();
        process.exit(0);
    }
};

// Create WebSocket connection
function createConnection() {
    socket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        path: '/ws'
    });

    socket.on('connect', () => {
        log.success(`Connected to server`);
        log.info(`Socket ID: ${socket.id}`);
    });

    socket.on('connect_error', (error) => {
        log.error(`Connection error: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
        log.warn(`Disconnected: ${reason}`);
    });

    socket.on('joined', (data) => {
        log.success(`Joined ${data.room} room: ${data.id || ''}`);
    });

    socket.on('pong', () => {
        log.success('Pong received!');
    });

    // Listen for all events (for debugging)
    socket.on('task:created', (data) => log.event('task:created', data));
    socket.on('task:completed', (data) => log.event('task:completed', data));
    socket.on('task:status', (data) => log.event('task:status', data));
    socket.on('project:updated', (data) => log.event('project:updated', data));
    socket.on('project:tasks:generated', (data) => log.event('project:tasks:generated', data));
    socket.on('device:status', (data) => log.event('device:status', data));
    socket.on('devicetype:tasks:new', (data) => log.event('devicetype:tasks:new', data));
    socket.on('alert:new', (data) => log.event('alert:new', data));
    socket.on('kpi:updated', (data) => log.event('kpi:updated', data));
    socket.on('system:announcement', (data) => log.event('system:announcement', data));

    socket.on('error', (error) => {
        log.error(`Socket error: ${error}`);
    });
}

// Parse and execute commands
function parseCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) return;

    const parts = trimmed.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    // Check for direct commands
    if (commands[command]) {
        commands[command]();
        return;
    }

    // Room join commands
    if (command.startsWith('join:')) {
        if (!socket?.connected) {
            log.error('Not connected to server');
            return;
        }
        const roomType = command.substring(5);
        const roomId = args.join(' ');

        if (roomType === 'alerts' || roomType === 'kpis') {
            socket.emit(command);
            log.command(`Joining ${roomType} room...`);
        } else if (roomId) {
            socket.emit(command, roomId);
            log.command(`Joining ${roomType} room: ${roomId}...`);
        } else {
            log.error(`Room ID required for ${roomType}`);
        }
        return;
    }

    // Leave command
    if (command === 'leave') {
        if (!socket?.connected) {
            log.error('Not connected to server');
            return;
        }
        const roomName = args.join(' ');
        if (roomName) {
            socket.emit('leave:' + roomName);
            log.command(`Leaving room: ${roomName}`);
        } else {
            log.error('Room name required');
        }
        return;
    }

    // Emit custom event
    if (command === 'emit') {
        if (!socket?.connected) {
            log.error('Not connected to server');
            return;
        }
        if (args.length < 1) {
            log.error('Usage: emit <event> [data]');
            return;
        }
        const event = args[0];
        const data = args.slice(1).join(' ');
        try {
            const parsed = data ? JSON.parse(data) : undefined;
            socket.emit(event, parsed);
            log.command(`Emitting event: ${event}`);
        } catch (e) {
            log.error(`Invalid JSON data: ${e.message}`);
        }
        return;
    }

    // Unknown command
    log.error(`Unknown command: ${command}`);
    log.info(`Type 'help' for available commands`);
}

// Main
function main() {
    showBanner();
    createConnection();

    rl.prompt();

    rl.on('line', (input) => {
        parseCommand(input);
        rl.prompt();
    });

    rl.on('close', () => {
        if (socket) socket.disconnect();
        process.exit(0);
    });
}

// Run
main();
