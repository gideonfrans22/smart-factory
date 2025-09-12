"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessLine = void 0;
var mongoose_1 = require("mongoose");
var ProcessLineSchema = new mongoose_1.Schema({
    lineNumber: {
        type: Number,
        required: true,
        unique: true,
        min: 1,
        max: 20
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    currentCapacity: {
        type: Number,
        default: 0,
        min: 0
    },
    maxCapacity: {
        type: Number,
        required: true,
        min: 1
    },
    averageProcessingTime: {
        type: Number,
        default: 0,
        min: 0
    },
    assignedWorkers: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }],
    status: {
        type: String,
        enum: ['operational', 'maintenance', 'offline'],
        default: 'operational'
    },
    lastMaintenance: {
        type: Date
    }
}, {
    timestamps: true
});
exports.ProcessLine = mongoose_1.default.model('ProcessLine', ProcessLineSchema);
