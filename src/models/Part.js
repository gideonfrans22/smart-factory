"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Part = void 0;
var mongoose_1 = require("mongoose");
var PartSchema = new mongoose_1.Schema({
    partId: {
        type: String,
        required: true,
        unique: true,
        trim: true
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
    category: {
        type: String,
        required: true,
        trim: true
    },
    requiredProcessLines: [{
            type: Number,
            required: true,
            min: 1,
            max: 20
        }],
    currentProcessLine: {
        type: Number,
        min: 1,
        max: 20
    },
    currentStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'on_hold'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    estimatedCompletionTime: {
        type: Date
    },
    actualCompletionTime: {
        type: Date
    },
    totalProcessingTime: {
        type: Number,
        default: 0,
        min: 0
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});
exports.Part = mongoose_1.default.model('Part', PartSchema);
