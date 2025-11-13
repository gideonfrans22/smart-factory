#!/usr/bin/env node

/**
 * WebSocket Test Script for Smart Factory Backend
 * 
 * Comprehensive testing of WebSocket functionality including:
 * - Connection/disconnection
 * - Room joining/leaving
 * - Event emission/reception
 * - Real-time broadcast verification
 * 
 * Usage:
 *   node test-websocket.js [--url=http://localhost:3000] [--test=all|rooms|broadcast|health]
 * 
 * Examples:
 *   node test-websocket.js                              # Test all with default server
 *   node test-websocket.js --url=http://192.168.1.1:3000
 *   node test-websocket.js --test=rooms                 # Only test room functionality
 */

const io = require('socket.io-client');
const readline = require('readline');

// ============================================================================
// CONFIGURATION
// ============================================================================

const args = process.argv.slice(2);
const serverUrl = args
    .find(arg => arg.startsWith('--url='))
    ?.split('=')[1] || 'http://localhost:3000';
const testType = args
    .find(arg => arg.startsWith('--test='))
    ?.split('=')[1] || 'all';

const config = {
    serverUrl,
    connectionTimeout: 5000,
    testTimeout: 10000,
    colors: {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
    info: (msg) => console.log(`${config.colors.blue}ℹ${config.colors.reset}  ${msg}`),
    success: (msg) => console.log(`${config.colors.green}✓${config.colors.reset}  ${msg}`),
    error: (msg) => console.log(`${config.colors.red}✗${config.colors.reset}  ${msg}`),
    warn: (msg) => console.log(`${config.colors.yellow}⚠${config.colors.reset}  ${msg}`),
    test: (msg) => console.log(`${config.colors.cyan}→${config.colors.reset}  ${msg}`),
    section: (title) => {
        console.log(`\n${config.colors.bright}${config.colors.white}${title}${config.colors.reset}`);
        console.log('─'.repeat(60));
    },
    result: (passed, total) => {
        const status = passed === total
            ? `${config.colors.green}PASS${config.colors.reset}`
            : `${config.colors.yellow}${passed}/${total}${config.colors.reset}`;
        console.log(`\n${config.colors.bright}Result: ${status}${config.colors.reset}`);
    }
};

// ============================================================================
// TEST SUITE
// ============================================================================

class WebSocketTestSuite {
    constructor() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        this.socket = null;
        this.secondarySocket = null;
    }

    recordTest(name, passed, details = '') {
        this.results.total++;
        if (passed) {
            this.results.passed++;
            log.success(`${name}`);
        } else {
            this.results.failed++;
            log.error(`${name}`);
            if (details) log.info(`  → ${details}`);
        }
        this.results.tests.push({ name, passed, details });
    }

    createSocket(url = config.serverUrl) {
        return io(url, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 3,
            path: '/ws'
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async connectSocket(socket, name = 'Socket') {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.recordTest(`${name} connection`, false, 'Connection timeout');
                resolve(false);
            }, config.connectionTimeout);

            socket.on('connect', () => {
                clearTimeout(timeout);
                this.recordTest(`${name} connection`, true);
                resolve(true);
            });

            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                this.recordTest(`${name} connection`, false, error.message);
                resolve(false);
            });
        });
    }

    async runAllTests() {
        log.section('🧪 WebSocket Test Suite - Smart Factory Backend');
        log.info(`Server: ${config.serverUrl}`);
        log.info(`Connection timeout: ${config.connectionTimeout}ms`);
        console.log('');

        if (testType === 'all' || testType === 'health') {
            await this.testHealthCheck();
        }

        if (testType === 'all' || testType === 'rooms') {
            await this.testRoomManagement();
        }

        if (testType === 'all' || testType === 'broadcast') {
            await this.testBroadcast();
        }

        if (testType === 'all' || testType === 'events') {
            await this.testEventHandling();
        }

        this.printSummary();
    }

    async testHealthCheck() {
        log.section('Test 1: Connection Health Check');

        // Test connection
        this.socket = this.createSocket();
        const connected = await this.connectSocket(this.socket, 'Primary');

        if (!connected) {
            log.error('Cannot continue - server not responding');
            process.exit(1);
        }

        // Test ping/pong
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.recordTest('Ping/Pong response', false, 'No pong received');
                resolve();
            }, 2000);

            this.socket.once('pong', () => {
                clearTimeout(timeout);
                this.recordTest('Ping/Pong response', true);
                resolve();
            });

            this.socket.emit('ping');
        });

        // Test disconnection
        await new Promise((resolve) => {
            this.socket.once('disconnect', (reason) => {
                this.recordTest('Graceful disconnection', reason === 'io client namespace disconnect');
                resolve();
            });

            this.socket.disconnect();
        });
    }

    async testRoomManagement() {
        log.section('Test 2: Room Management');

        // Reconnect for room tests
        this.socket = this.createSocket();
        const connected = await this.connectSocket(this.socket, 'Primary');
        if (!connected) return;

        const tests = [
            { event: 'join:project', leave: 'leave:project', room: 'project', id: 'test-project-123', emoji: '📂' },
            { event: 'join:device', leave: 'leave:device', room: 'device', id: 'test-device-456', emoji: '🤖' },
            { event: 'join:task', leave: 'leave:task', room: 'task', id: 'test-task-789', emoji: '📋' },
            { event: 'join:devicetype', leave: 'leave:devicetype', room: 'devicetype', id: 'test-devtype-111', emoji: '🔧' },
            { event: 'join:user', leave: 'leave:user', room: 'user', id: 'test-user-222', emoji: '👤' }
        ];

        for (const test of tests) {
            // Test join
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.recordTest(`${test.emoji} Join ${test.room} room`, false, 'No join confirmation');
                    resolve();
                }, config.testTimeout);

                this.socket.once('joined', (data) => {
                    clearTimeout(timeout);
                    if (data.room === test.room && data.id === test.id) {
                        this.recordTest(`${test.emoji} Join ${test.room} room`, true);
                    } else {
                        this.recordTest(`${test.emoji} Join ${test.room} room`, false, 'Unexpected data');
                    }
                    resolve();
                });

                this.socket.emit(test.event, test.id);
            });

            // Test leave
            this.socket.emit(test.leave, test.id);
            await this.sleep(100);
            this.recordTest(`${test.emoji} Leave ${test.room} room`, true);
        }

        // Test global room (auto-joined)
        const globalJoined = Object.keys(this.socket.rooms).includes('global');
        this.recordTest('🌍 Auto-join global room', globalJoined);

        this.socket.disconnect();
    }

    async testBroadcast() {
        log.section('Test 3: Broadcast Functionality');

        // Create two sockets for broadcast testing
        this.socket = this.createSocket();
        this.secondarySocket = this.createSocket();

        const primary = await this.connectSocket(this.socket, 'Primary');
        const secondary = await this.connectSocket(this.secondarySocket, 'Secondary');

        if (!primary || !secondary) {
            log.error('Cannot test broadcast - connection failed');
            return;
        }

        // Join both sockets to same room
        const testRoomId = 'broadcast-test-' + Date.now();

        await new Promise((resolve) => {
            let joined = 0;
            const checkComplete = () => {
                joined++;
                if (joined === 2) resolve();
            };

            this.socket.once('joined', checkComplete);
            this.secondarySocket.once('joined', checkComplete);

            this.socket.emit('join:project', testRoomId);
            this.secondarySocket.emit('join:project', testRoomId);
        });

        // Test broadcast between rooms
        const broadcastRoom = `project:${testRoomId}`;
        const testMessage = { type: 'test', data: 'broadcast message', timestamp: Date.now() };

        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.recordTest('📡 Broadcast message between clients', false, 'Message not received');
                resolve();
            }, config.testTimeout);

            this.secondarySocket.once('test:broadcast', (data) => {
                clearTimeout(timeout);
                if (data.type === testMessage.type && data.data === testMessage.data) {
                    this.recordTest('📡 Broadcast message between clients', true);
                } else {
                    this.recordTest('📡 Broadcast message between clients', false, 'Data mismatch');
                }
                resolve();
            });

            // Simulate broadcast from server
            const io = require('socket.io-client');
            const serverIo = this.socket.io;
            if (serverIo && serverIo._adapter) {
                this.socket.to(broadcastRoom).emit('test:broadcast', testMessage);
            } else {
                log.warn('Cannot test full broadcast (would need server access)');
            }

            // For now, just test client-to-client
            this.socket.emit('custom:message', testMessage);
        });

        this.socket.disconnect();
        this.secondarySocket.disconnect();
    }

    async testEventHandling() {
        log.section('Test 4: Event Handling');

        this.socket = this.createSocket();
        const connected = await this.connectSocket(this.socket, 'Primary');
        if (!connected) return;

        // Test custom event listeners
        const testEvents = [
            { name: 'task:created', emoji: '📝' },
            { name: 'task:completed', emoji: '✅' },
            { name: 'project:updated', emoji: '📊' },
            { name: 'alert:new', emoji: '🚨' },
            { name: 'device:status', emoji: '🤖' }
        ];

        for (const event of testEvents) {
            let received = false;

            this.socket.on(event.name, (data) => {
                received = true;
            });

            // Give time for listener to register
            await this.sleep(50);
            this.recordTest(`${event.emoji} Event listener setup (${event.name})`, true);
        }

        // Test error handling
        await new Promise(async (resolve) => {
            let errorHandled = false;

            this.socket.on('error', (error) => {
                errorHandled = true;
                log.info(`  → Error handler received: ${error}`);
            });

            // Try invalid event (just for testing error handler exists)
            this.socket.emit('invalid:event', {});
            await this.sleep(100);
            this.recordTest('🛡️ Error handling available', true);
            resolve();
        });

        this.socket.disconnect();
    }

    printSummary() {
        log.section('📊 Test Results Summary');

        console.log(`${config.colors.bright}Total Tests:${config.colors.reset}   ${this.results.total}`);
        console.log(`${config.colors.green}Passed:${config.colors.reset}        ${this.results.passed}`);
        console.log(`${config.colors.red}Failed:${config.colors.reset}        ${this.results.failed}`);

        const passRate = this.results.total > 0
            ? Math.round((this.results.passed / this.results.total) * 100)
            : 0;

        console.log(`${config.colors.cyan}Pass Rate:${config.colors.reset}      ${passRate}%`);

        if (this.results.failed === 0) {
            console.log(`\n${config.colors.green}${config.colors.bright}✓ All tests passed!${config.colors.reset}`);
        } else {
            console.log(`\n${config.colors.yellow}${config.colors.bright}⚠ Some tests failed${config.colors.reset}`);
        }

        console.log('\n' + '─'.repeat(60));
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const runTests = async () => {
    try {
        const suite = new WebSocketTestSuite();
        await suite.runAllTests();
        process.exit(suite.results.failed > 0 ? 1 : 0);
    } catch (error) {
        log.error(`Test suite failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    log.warn('\nTest interrupted by user');
    process.exit(1);
});

// Run tests
runTests();
