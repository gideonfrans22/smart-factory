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
exports.sanitizeInput = exports.validateEmail = exports.isValidProcessLine = exports.formatDuration = exports.calculateProgressPercentage = exports.generatePartId = exports.verifyToken = exports.generateToken = exports.comparePassword = exports.hashPassword = void 0;
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
var JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
var hashPassword = function (password) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, bcrypt.hash(password, SALT_ROUNDS)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.hashPassword = hashPassword;
var comparePassword = function (password, hashedPassword) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, bcrypt.compare(password, hashedPassword)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.comparePassword = comparePassword;
var generateToken = function (payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
exports.generateToken = generateToken;
var verifyToken = function (token) {
    return jwt.verify(token, JWT_SECRET);
};
exports.verifyToken = verifyToken;
var generatePartId = function (category) {
    var timestamp = Date.now().toString(36);
    var random = Math.random().toString(36).substr(2, 5);
    var categoryCode = category.substring(0, 3).toUpperCase();
    return "".concat(categoryCode, "-").concat(timestamp, "-").concat(random);
};
exports.generatePartId = generatePartId;
var calculateProgressPercentage = function (completedProcessLines, totalRequiredProcessLines) {
    if (totalRequiredProcessLines.length === 0)
        return 0;
    return Math.round((completedProcessLines.length / totalRequiredProcessLines.length) * 100);
};
exports.calculateProgressPercentage = calculateProgressPercentage;
var formatDuration = function (minutes) {
    var hours = Math.floor(minutes / 60);
    var mins = Math.round(minutes % 60);
    if (hours > 0) {
        return "".concat(hours, "h ").concat(mins, "m");
    }
    return "".concat(mins, "m");
};
exports.formatDuration = formatDuration;
var isValidProcessLine = function (lineNumber) {
    return lineNumber >= 1 && lineNumber <= 20;
};
exports.isValidProcessLine = isValidProcessLine;
var validateEmail = function (email) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
var sanitizeInput = function (input) {
    return input.trim().replace(/[<>]/g, '');
};
exports.sanitizeInput = sanitizeInput;
