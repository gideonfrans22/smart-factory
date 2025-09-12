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
exports.getProfile = exports.login = exports.register = void 0;
var User_1 = require("../models/User");
var helpers_1 = require("../utils/helpers");
var register = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, username, email, password, role, assignedProcessLine, firstName, lastName, response_1, response_2, response_3, response_4, existingUser, response_5, hashedPassword, user, response, error_1, response;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = req.body, username = _a.username, email = _a.email, password = _a.password, role = _a.role, assignedProcessLine = _a.assignedProcessLine, firstName = _a.firstName, lastName = _a.lastName;
                // Validation
                if (!username || !email || !password || !role || !firstName || !lastName) {
                    response_1 = {
                        success: false,
                        message: 'All required fields must be provided'
                    };
                    res.status(400).json(response_1);
                    return [2 /*return*/];
                }
                if (!(0, helpers_1.validateEmail)(email)) {
                    response_2 = {
                        success: false,
                        message: 'Invalid email format'
                    };
                    res.status(400).json(response_2);
                    return [2 /*return*/];
                }
                if (password.length < 6) {
                    response_3 = {
                        success: false,
                        message: 'Password must be at least 6 characters long'
                    };
                    res.status(400).json(response_3);
                    return [2 /*return*/];
                }
                if (role === 'worker' && !assignedProcessLine) {
                    response_4 = {
                        success: false,
                        message: 'Process line assignment required for workers'
                    };
                    res.status(400).json(response_4);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, User_1.User.findOne({
                        $or: [{ username: username }, { email: email }]
                    })];
            case 1:
                existingUser = _b.sent();
                if (existingUser) {
                    response_5 = {
                        success: false,
                        message: 'Username or email already exists'
                    };
                    res.status(400).json(response_5);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, helpers_1.hashPassword)(password)];
            case 2:
                hashedPassword = _b.sent();
                user = new User_1.User({
                    username: (0, helpers_1.sanitizeInput)(username),
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: role,
                    assignedProcessLine: role === 'worker' ? assignedProcessLine : undefined,
                    firstName: (0, helpers_1.sanitizeInput)(firstName),
                    lastName: (0, helpers_1.sanitizeInput)(lastName)
                });
                return [4 /*yield*/, user.save()];
            case 3:
                _b.sent();
                response = {
                    success: true,
                    message: 'User registered successfully',
                    data: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        assignedProcessLine: user.assignedProcessLine,
                        firstName: user.firstName,
                        lastName: user.lastName
                    }
                };
                res.status(201).json(response);
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                console.error('Registration error:', error_1);
                response = {
                    success: false,
                    message: 'Internal server error'
                };
                res.status(500).json(response);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.register = register;
var login = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, username, password, response_6, user, response_7, isValidPassword, response_8, tokenPayload, token, response, error_2, response;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = req.body, username = _a.username, password = _a.password;
                if (!username || !password) {
                    response_6 = {
                        success: false,
                        message: 'Username and password are required'
                    };
                    res.status(400).json(response_6);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, User_1.User.findOne({ username: username })];
            case 1:
                user = _b.sent();
                if (!user || !user.isActive) {
                    response_7 = {
                        success: false,
                        message: 'Invalid credentials'
                    };
                    res.status(401).json(response_7);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, helpers_1.comparePassword)(password, user.password)];
            case 2:
                isValidPassword = _b.sent();
                if (!isValidPassword) {
                    response_8 = {
                        success: false,
                        message: 'Invalid credentials'
                    };
                    res.status(401).json(response_8);
                    return [2 /*return*/];
                }
                // Update last login
                user.lastLogin = new Date();
                return [4 /*yield*/, user.save()];
            case 3:
                _b.sent();
                tokenPayload = {
                    userId: user._id.toString(),
                    username: user.username,
                    role: user.role,
                    assignedProcessLine: user.assignedProcessLine
                };
                token = (0, helpers_1.generateToken)(tokenPayload);
                response = {
                    success: true,
                    message: 'Login successful',
                    data: {
                        token: token,
                        user: {
                            id: user._id,
                            username: user.username,
                            role: user.role,
                            assignedProcessLine: user.assignedProcessLine,
                            firstName: user.firstName,
                            lastName: user.lastName
                        }
                    }
                };
                res.json(response);
                return [3 /*break*/, 5];
            case 4:
                error_2 = _b.sent();
                console.error('Login error:', error_2);
                response = {
                    success: false,
                    message: 'Internal server error'
                };
                res.status(500).json(response);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.login = login;
var getProfile = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, response_9, response, response;
    return __generator(this, function (_a) {
        try {
            user = req.user;
            if (!user) {
                response_9 = {
                    success: false,
                    message: 'User not found'
                };
                res.status(404).json(response_9);
                return [2 /*return*/];
            }
            response = {
                success: true,
                message: 'Profile retrieved successfully',
                data: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    assignedProcessLine: user.assignedProcessLine,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    lastLogin: user.lastLogin
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Get profile error:', error);
            response = {
                success: false,
                message: 'Internal server error'
            };
            res.status(500).json(response);
        }
        return [2 /*return*/];
    });
}); };
exports.getProfile = getProfile;
