#!/usr/bin/env node

/**
 * Quick WebSocket Validation Test
 * 
 * Simple script to quickly check if WebSocket server is responding
 * Usage:
 *   node test-websocket-quick.js [url]
 * 
 * Examples:
 *   node test-websocket-quick.js                    # Uses http://localhost:3000
 *   node test-websocket-quick.js http://192.168.1.1:3000
 */

const io = require('socket.io-client');

const serverUrl = process.argv[2] || 'http://localhost:3000';
const timeout = 10000;

console.log('🔌 WebSocket Quick Test');
console.log('═'.repeat(50));
console.log(`Server: ${serverUrl}`);
console.log(`Timeout: ${timeout}ms`);
console.log('');

let testsPassed = 0;
let testsFailed = 0;

const socket = io(serverUrl, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 3,
    path: '/ws'
});

// Test 1: Connection
console.log('Test 1: Connection...');
const connectionTimeout = setTimeout(() => {
    console.log('✗ FAILED - Connection timeout');
    testsFailed++;
    cleanup();
}, timeout);

socket.on('connect', () => {
    clearTimeout(connectionTimeout);
    console.log('✓ PASSED - Connected to server');
    testsPassed++;

    // Test 2: Socket ID
    if (socket.id) {
        console.log(`✓ PASSED - Socket ID received: ${socket.id}`);
        testsPassed++;
    } else {
        console.log('✗ FAILED - No Socket ID');
        testsFailed++;
    }

    // Test 3: Ping/Pong
    console.log('Test 3: Ping/Pong...');
    const pingTimeout = setTimeout(() => {
        console.log('✗ FAILED - No pong response');
        testsFailed++;
        runMoreTests();
    }, 2000);

    socket.once('pong', () => {
        clearTimeout(pingTimeout);
        console.log('✓ PASSED - Pong received');
        testsPassed++;
        runMoreTests();
    });

    socket.emit('ping');
});

socket.on('connect_error', (error) => {
    clearTimeout(connectionTimeout);
    console.log(`✗ FAILED - Connection error: ${error.message}`);
    testsFailed++;
    cleanup();
});

socket.on('error', (error) => {
    console.log(`✗ ERROR - ${error}`);
    testsFailed++;
});

async function runMoreTests() {
    console.log('');

    // Test 4: Room joining
    console.log('Test 4: Room Management...');
    const roomTestRuns = [
        { event: 'join:project', id: 'test-proj-1' },
        { event: 'join:device', id: 'test-dev-1' },
        { event: 'join:task', id: 'test-task-1' },
        { event: 'join:alerts' },
        { event: 'join:kpis' },
        { event: 'join:devicetype', id: 'test-dt-1' }
    ];

    for (const test of roomTestRuns) {
        await new Promise((resolve) => {
            const roomTimeout = setTimeout(() => {
                console.log(`  ✗ ${test.event} - No confirmation`);
                testsFailed++;
                resolve();
            }, 1000);

            socket.once('joined', (data) => {
                clearTimeout(roomTimeout);
                console.log(`  ✓ ${test.event} - Room joined`);
                testsPassed++;
                resolve();
            });

            if (test.id) {
                socket.emit(test.event, test.id);
            } else {
                socket.emit(test.event);
            }
        });
    }

    console.log('');
    console.log('═'.repeat(50));
    console.log('Test Results:');
    console.log(`  Passed: ${testsPassed}`);
    console.log(`  Failed: ${testsFailed}`);
    console.log(`  Total:  ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
        console.log('\n✓ All tests passed!');
    } else {
        console.log(`\n⚠ ${testsFailed} test(s) failed`);
    }

    cleanup();
}

function cleanup() {
    socket.disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Cleanup on interrupt
process.on('SIGINT', () => {
    console.log('\n\nInterrupted by user');
    cleanup();
});
