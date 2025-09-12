"use strict";
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
exports.runSeeder = exports.seedDefaultUsers = exports.seedProcessLines = void 0;
var ProcessLine_1 = require("../models/ProcessLine");
var User_1 = require("../models/User");
var database_1 = require("../config/database");
var helpers_1 = require("../utils/helpers");
var seedProcessLines = function () { return __awaiter(void 0, void 0, void 0, function () {
    var processLinesData, _i, processLinesData_1, lineData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                console.log('🌱 Seeding process lines...');
                processLinesData = [
                    { lineNumber: 1, name: 'Initial Processing', description: 'First stage component preparation', maxCapacity: 10 },
                    { lineNumber: 2, name: 'Quality Inspection', description: 'Initial quality check and sorting', maxCapacity: 8 },
                    { lineNumber: 3, name: 'Component Assembly', description: 'Basic component assembly', maxCapacity: 12 },
                    { lineNumber: 4, name: 'Precision Machining', description: 'High precision machining operations', maxCapacity: 6 },
                    { lineNumber: 5, name: 'Surface Treatment', description: 'Surface coating and treatment', maxCapacity: 15 },
                    { lineNumber: 6, name: 'Heat Treatment', description: 'Thermal processing and hardening', maxCapacity: 10 },
                    { lineNumber: 7, name: 'Advanced Assembly', description: 'Complex component assembly', maxCapacity: 8 },
                    { lineNumber: 8, name: 'Testing Station', description: 'Functional and performance testing', maxCapacity: 12 },
                    { lineNumber: 9, name: 'Calibration', description: 'Precision calibration and adjustment', maxCapacity: 6 },
                    { lineNumber: 10, name: 'Final Inspection', description: 'Final quality assurance check', maxCapacity: 10 },
                    { lineNumber: 11, name: 'Packaging Prep', description: 'Preparation for packaging', maxCapacity: 20 },
                    { lineNumber: 12, name: 'Documentation', description: 'Technical documentation and labeling', maxCapacity: 15 },
                    { lineNumber: 13, name: 'Special Processing', description: 'Specialized processing operations', maxCapacity: 5 },
                    { lineNumber: 14, name: 'Rework Station', description: 'Component rework and repair', maxCapacity: 8 },
                    { lineNumber: 15, name: 'Advanced Testing', description: 'Specialized testing procedures', maxCapacity: 6 },
                    { lineNumber: 16, name: 'Clean Room Assembly', description: 'Clean environment assembly', maxCapacity: 4 },
                    { lineNumber: 17, name: 'Micro Processing', description: 'Microscopic component processing', maxCapacity: 3 },
                    { lineNumber: 18, name: 'Final Assembly', description: 'Final product assembly', maxCapacity: 10 },
                    { lineNumber: 19, name: 'Quality Certification', description: 'Final quality certification', maxCapacity: 8 },
                    { lineNumber: 20, name: 'Shipping Prep', description: 'Final packaging and shipping preparation', maxCapacity: 25 }
                ];
                _i = 0, processLinesData_1 = processLinesData;
                _a.label = 1;
            case 1:
                if (!(_i < processLinesData_1.length)) return [3 /*break*/, 4];
                lineData = processLinesData_1[_i];
                return [4 /*yield*/, ProcessLine_1.ProcessLine.findOneAndUpdate({ lineNumber: lineData.lineNumber }, lineData, { upsert: true, new: true })];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                console.log('✅ Process lines seeded successfully');
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error('❌ Error seeding process lines:', error_1);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.seedProcessLines = seedProcessLines;
var seedDefaultUsers = function () { return __awaiter(void 0, void 0, void 0, function () {
    var managerExists, managerPassword, i, workerExists, workerPassword, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 11, , 12]);
                console.log('👥 Seeding default users...');
                return [4 /*yield*/, User_1.User.findOne({ username: 'manager' })];
            case 1:
                managerExists = _a.sent();
                if (!!managerExists) return [3 /*break*/, 4];
                return [4 /*yield*/, (0, helpers_1.hashPassword)('manager123')];
            case 2:
                managerPassword = _a.sent();
                return [4 /*yield*/, User_1.User.create({
                        username: 'manager',
                        email: 'manager@smartfactory.com',
                        password: managerPassword,
                        role: 'manager',
                        firstName: 'Factory',
                        lastName: 'Manager'
                    })];
            case 3:
                _a.sent();
                console.log('✅ Default manager created (username: manager, password: manager123)');
                _a.label = 4;
            case 4:
                i = 1;
                _a.label = 5;
            case 5:
                if (!(i <= 5)) return [3 /*break*/, 10];
                return [4 /*yield*/, User_1.User.findOne({ username: "worker".concat(i) })];
            case 6:
                workerExists = _a.sent();
                if (!!workerExists) return [3 /*break*/, 9];
                return [4 /*yield*/, (0, helpers_1.hashPassword)('worker123')];
            case 7:
                workerPassword = _a.sent();
                return [4 /*yield*/, User_1.User.create({
                        username: "worker".concat(i),
                        email: "worker".concat(i, "@smartfactory.com"),
                        password: workerPassword,
                        role: 'worker',
                        assignedProcessLine: i,
                        firstName: "Worker",
                        lastName: "".concat(i)
                    })];
            case 8:
                _a.sent();
                _a.label = 9;
            case 9:
                i++;
                return [3 /*break*/, 5];
            case 10:
                console.log('✅ Default workers created (username: worker1-5, password: worker123)');
                return [3 /*break*/, 12];
            case 11:
                error_2 = _a.sent();
                console.error('❌ Error seeding users:', error_2);
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); };
exports.seedDefaultUsers = seedDefaultUsers;
var runSeeder = function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, (0, database_1.connectDB)()];
            case 1:
                _a.sent();
                return [4 /*yield*/, seedProcessLines()];
            case 2:
                _a.sent();
                return [4 /*yield*/, seedDefaultUsers()];
            case 3:
                _a.sent();
                console.log('🎉 Seeding completed successfully!');
                process.exit(0);
                return [3 /*break*/, 5];
            case 4:
                error_3 = _a.sent();
                console.error('❌ Seeding failed:', error_3);
                process.exit(1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.runSeeder = runSeeder;
// Run seeder if called directly
if (require.main === module) {
    runSeeder();
}
