"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var cors = require("cors");
var helmet_1 = require("helmet");
var dotenv = require("dotenv");
var express_rate_limit_1 = require("express-rate-limit");
// Import configurations
var database_1 = require("./config/database");
var mqtt_1 = require("./config/mqtt");
// Import routes
var auth_1 = require("./routes/auth");
// Import services
var monitoringService_1 = require("./services/monitoringService");
// Load environment variables
dotenv.config();
var app = express();
var PORT = process.env.PORT || 3000;
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
var corsOptions = {
    origin: ((_a = process.env.CORS_ORIGIN) === null || _a === void 0 ? void 0 : _a.split(',')) || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
};
app.use(cors(corsOptions));
// Rate limiting
var limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100') // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// API Routes
app.use('/api/auth', auth_1.default);
// Health check and info routes
app.get('/', function (req, res) {
    res.json({
        message: 'Smart Factory Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        features: [
            'User Authentication (JWT)',
            'Process Management',
            'Real-time MQTT Monitoring',
            'MongoDB Database',
            'Production Analytics'
        ]
    });
});
app.get('/api/health', function (req, res) {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        mqtt: mqtt_1.mqttService.isConnected() ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});
// 404 handler
app.use('*', function (req, res) {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});
// Global error handler
app.use(function (error, req, res, next) {
    console.error('Global error handler:', error);
    res.status(error.status || 500).json(__assign({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message }, (process.env.NODE_ENV !== 'production' && { stack: error.stack })));
});
// Initialize services and start server
var startServer = function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                // Connect to MongoDB
                return [4 /*yield*/, (0, database_1.connectDB)()];
            case 1:
                // Connect to MongoDB
                _a.sent();
                // Connect to MQTT broker
                return [4 /*yield*/, mqtt_1.mqttService.connect()];
            case 2:
                // Connect to MQTT broker
                _a.sent();
                // Initialize monitoring service
                return [4 /*yield*/, monitoringService_1.monitoringService.initializeMonitoring()];
            case 3:
                // Initialize monitoring service
                _a.sent();
                // Start HTTP server
                app.listen(PORT, function () {
                    console.log('🚀 Smart Factory Backend Server Started');
                    console.log("\uD83D\uDCF1 API available at http://localhost:".concat(PORT));
                    console.log("\uD83C\uDFED Environment: ".concat(process.env.NODE_ENV || 'development'));
                    console.log('✅ All services initialized successfully');
                });
                return [3 /*break*/, 5];
            case 4:
                error_1 = _a.sent();
                console.error('❌ Failed to start server:', error_1);
                process.exit(1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
// Handle graceful shutdown
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('📤 SIGTERM received, shutting down gracefully...');
        mqtt_1.mqttService.disconnect();
        process.exit(0);
        return [2 /*return*/];
    });
}); });
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('📤 SIGINT received, shutting down gracefully...');
        mqtt_1.mqttService.disconnect();
        process.exit(0);
        return [2 /*return*/];
    });
}); });
// Start the server
startServer();
exports.default = app;
