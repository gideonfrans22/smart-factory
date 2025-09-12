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
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = void 0;
var mqtt_1 = require("../config/mqtt");
var ProcessRecord_1 = require("../models/ProcessRecord");
var Part_1 = require("../models/Part");
var ProcessLine_1 = require("../models/ProcessLine");
var MonitoringService = /** @class */ (function () {
    function MonitoringService() {
    }
    MonitoringService.prototype.initializeMonitoring = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Subscribe to worker actions
                mqtt_1.mqttService.subscribe(mqtt_1.MQTT_TOPICS.WORKER_ACTION, this.handleWorkerAction.bind(this));
                // Subscribe to manager commands
                mqtt_1.mqttService.subscribe(mqtt_1.MQTT_TOPICS.MANAGER_COMMAND, this.handleManagerCommand.bind(this));
                console.log('🔍 Monitoring service initialized');
                return [2 /*return*/];
            });
        });
    };
    MonitoringService.prototype.handleWorkerAction = function (topic, message) {
        return __awaiter(this, void 0, void 0, function () {
            var action, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        action = JSON.parse(message);
                        console.log('Worker action received:', action);
                        // Process the worker action
                        return [4 /*yield*/, this.processWorkerAction(action)];
                    case 1:
                        // Process the worker action
                        _a.sent();
                        // Broadcast updated status
                        return [4 /*yield*/, this.broadcastProcessLineStatus(action.processLineNumber)];
                    case 2:
                        // Broadcast updated status
                        _a.sent();
                        return [4 /*yield*/, this.broadcastPartProgress(action.partId)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Error handling worker action:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    MonitoringService.prototype.handleManagerCommand = function (topic, message) {
        return __awaiter(this, void 0, void 0, function () {
            var command;
            return __generator(this, function (_a) {
                try {
                    command = JSON.parse(message);
                    console.log('Manager command received:', command);
                    // Handle different manager commands (part assignment, process line config, etc.)
                    // Implementation depends on command type
                }
                catch (error) {
                    console.error('Error handling manager command:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    MonitoringService.prototype.processWorkerAction = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var workerId, processLineNumber, partId, actionType, processRecord, part, _a, duration;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        workerId = action.workerId, processLineNumber = action.processLineNumber, partId = action.partId, actionType = action.action;
                        return [4 /*yield*/, ProcessRecord_1.ProcessRecord.findOne({
                                partId: partId,
                                processLineNumber: processLineNumber,
                                status: { $in: ['queued', 'started', 'paused'] }
                            })];
                    case 1:
                        processRecord = _b.sent();
                        return [4 /*yield*/, Part_1.Part.findOne({ partId: partId })];
                    case 2:
                        part = _b.sent();
                        if (!part) {
                            throw new Error("Part ".concat(partId, " not found"));
                        }
                        _a = actionType;
                        switch (_a) {
                            case 'start': return [3 /*break*/, 3];
                            case 'complete': return [3 /*break*/, 4];
                            case 'pause': return [3 /*break*/, 6];
                            case 'resume': return [3 /*break*/, 7];
                            case 'fail': return [3 /*break*/, 8];
                        }
                        return [3 /*break*/, 9];
                    case 3:
                        if (!processRecord) {
                            processRecord = new ProcessRecord_1.ProcessRecord({
                                partId: part._id,
                                processLineNumber: processLineNumber,
                                workerId: workerId,
                                status: 'started',
                                startTime: new Date()
                            });
                        }
                        else {
                            processRecord.status = 'started';
                            processRecord.startTime = new Date();
                        }
                        // Update part status
                        part.currentProcessLine = processLineNumber;
                        part.currentStatus = 'in_progress';
                        return [3 /*break*/, 9];
                    case 4:
                        if (processRecord) {
                            processRecord.status = 'completed';
                            processRecord.endTime = new Date();
                            // Calculate processing duration
                            if (processRecord.startTime) {
                                duration = (new Date().getTime() - processRecord.startTime.getTime()) / (1000 * 60);
                                processRecord.processingDuration = duration;
                            }
                        }
                        // Move part to next process line or mark as completed
                        return [4 /*yield*/, this.movePartToNextProcessLine(part)];
                    case 5:
                        // Move part to next process line or mark as completed
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 6:
                        if (processRecord) {
                            processRecord.status = 'paused';
                        }
                        part.currentStatus = 'on_hold';
                        return [3 /*break*/, 9];
                    case 7:
                        if (processRecord) {
                            processRecord.status = 'started';
                        }
                        part.currentStatus = 'in_progress';
                        return [3 /*break*/, 9];
                    case 8:
                        if (processRecord) {
                            processRecord.status = 'failed';
                        }
                        part.currentStatus = 'on_hold';
                        return [3 /*break*/, 9];
                    case 9:
                        if (!processRecord) return [3 /*break*/, 11];
                        processRecord.notes = action.notes;
                        return [4 /*yield*/, processRecord.save()];
                    case 10:
                        _b.sent();
                        _b.label = 11;
                    case 11: return [4 /*yield*/, part.save()];
                    case 12:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MonitoringService.prototype.movePartToNextProcessLine = function (part) {
        return __awaiter(this, void 0, void 0, function () {
            var currentIndex, nextProcessRecord, processRecords, totalTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentIndex = part.requiredProcessLines.indexOf(part.currentProcessLine);
                        if (!(currentIndex < part.requiredProcessLines.length - 1)) return [3 /*break*/, 2];
                        // Move to next process line
                        part.currentProcessLine = part.requiredProcessLines[currentIndex + 1];
                        part.currentStatus = 'pending';
                        nextProcessRecord = new ProcessRecord_1.ProcessRecord({
                            partId: part._id,
                            processLineNumber: part.currentProcessLine,
                            status: 'queued'
                        });
                        return [4 /*yield*/, nextProcessRecord.save()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        // Part completed all process lines
                        part.currentProcessLine = undefined;
                        part.currentStatus = 'completed';
                        part.actualCompletionTime = new Date();
                        return [4 /*yield*/, ProcessRecord_1.ProcessRecord.find({ partId: part._id })];
                    case 3:
                        processRecords = _a.sent();
                        totalTime = processRecords.reduce(function (sum, record) { return sum + (record.processingDuration || 0); }, 0);
                        part.totalProcessingTime = totalTime;
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MonitoringService.prototype.broadcastProcessLineStatus = function (lineNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var status;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getProcessLineStatus(lineNumber)];
                    case 1:
                        status = _a.sent();
                        mqtt_1.mqttService.publish(mqtt_1.MQTT_TOPICS.PROCESS_LINE_STATUS, __assign(__assign({ lineNumber: lineNumber }, status), { timestamp: new Date() }));
                        return [2 /*return*/];
                }
            });
        });
    };
    MonitoringService.prototype.broadcastPartProgress = function (partId) {
        return __awaiter(this, void 0, void 0, function () {
            var progress;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getPartProgress(partId)];
                    case 1:
                        progress = _a.sent();
                        mqtt_1.mqttService.publish(mqtt_1.MQTT_TOPICS.PART_PROGRESS, __assign(__assign({ partId: partId }, progress), { timestamp: new Date() }));
                        return [2 /*return*/];
                }
            });
        });
    };
    MonitoringService.prototype.getProcessLineStatus = function (lineNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var processLine, partsInQueue;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ProcessLine_1.ProcessLine.findOne({ lineNumber: lineNumber })];
                    case 1:
                        processLine = _a.sent();
                        if (!processLine) {
                            throw new Error("Process line ".concat(lineNumber, " not found"));
                        }
                        return [4 /*yield*/, ProcessRecord_1.ProcessRecord.countDocuments({
                                processLineNumber: lineNumber,
                                status: 'queued'
                            })];
                    case 2:
                        partsInQueue = _a.sent();
                        return [2 /*return*/, {
                                lineNumber: lineNumber,
                                status: processLine.status,
                                currentCapacity: processLine.currentCapacity,
                                maxCapacity: processLine.maxCapacity,
                                partsInQueue: partsInQueue,
                                averageProcessingTime: processLine.averageProcessingTime
                            }];
                }
            });
        });
    };
    MonitoringService.prototype.getPartProgress = function (partId) {
        return __awaiter(this, void 0, void 0, function () {
            var part, completedRecords, completedProcessLines, remainingProcessLines, progressPercentage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Part_1.Part.findOne({ partId: partId })];
                    case 1:
                        part = _a.sent();
                        if (!part) {
                            throw new Error("Part ".concat(partId, " not found"));
                        }
                        return [4 /*yield*/, ProcessRecord_1.ProcessRecord.find({
                                partId: part._id,
                                status: 'completed'
                            })];
                    case 2:
                        completedRecords = _a.sent();
                        completedProcessLines = completedRecords.map(function (record) { return record.processLineNumber; });
                        remainingProcessLines = part.requiredProcessLines.filter(function (line) { return !completedProcessLines.includes(line); });
                        progressPercentage = Math.round((completedProcessLines.length / part.requiredProcessLines.length) * 100);
                        return [2 /*return*/, {
                                partId: partId,
                                currentProcessLine: part.currentProcessLine,
                                completedProcessLines: completedProcessLines,
                                remainingProcessLines: remainingProcessLines,
                                status: part.currentStatus,
                                progressPercentage: progressPercentage
                            }];
                }
            });
        });
    };
    MonitoringService.prototype.getProductionMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var today, _a, totalPartsProduced, totalPartsInProgress, dailyProduction, avgCompletionTime, processLineEfficiency, i, completedToday;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return [4 /*yield*/, Promise.all([
                                Part_1.Part.countDocuments({ currentStatus: 'completed' }),
                                Part_1.Part.countDocuments({ currentStatus: { $in: ['pending', 'in_progress', 'on_hold'] } }),
                                Part_1.Part.countDocuments({
                                    currentStatus: 'completed',
                                    actualCompletionTime: { $gte: today }
                                }),
                                Part_1.Part.aggregate([
                                    { $match: { currentStatus: 'completed', totalProcessingTime: { $gt: 0 } } },
                                    { $group: { _id: null, avgTime: { $avg: '$totalProcessingTime' } } }
                                ])
                            ])];
                    case 1:
                        _a = _c.sent(), totalPartsProduced = _a[0], totalPartsInProgress = _a[1], dailyProduction = _a[2], avgCompletionTime = _a[3];
                        processLineEfficiency = {};
                        i = 1;
                        _c.label = 2;
                    case 2:
                        if (!(i <= 20)) return [3 /*break*/, 5];
                        return [4 /*yield*/, ProcessRecord_1.ProcessRecord.countDocuments({
                                processLineNumber: i,
                                status: 'completed',
                                createdAt: { $gte: today }
                            })];
                    case 3:
                        completedToday = _c.sent();
                        processLineEfficiency[i] = completedToday; // Simplified metric
                        _c.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, {
                            totalPartsProduced: totalPartsProduced,
                            totalPartsInProgress: totalPartsInProgress,
                            dailyProduction: dailyProduction,
                            averageCompletionTime: ((_b = avgCompletionTime[0]) === null || _b === void 0 ? void 0 : _b.avgTime) || 0,
                            processLineEfficiency: processLineEfficiency,
                            workerPerformance: {} // To be implemented based on requirements
                        }];
                }
            });
        });
    };
    return MonitoringService;
}());
exports.monitoringService = new MonitoringService();
