"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessRecord = void 0;
var mongoose_1 = require("mongoose");
var ProcessRecordSchema = new mongoose_1.Schema({
    partId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Part',
        required: true
    },
    processLineNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    workerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['queued', 'started', 'completed', 'paused', 'failed'],
        default: 'queued'
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    processingDuration: {
        type: Number,
        min: 0
    },
    notes: {
        type: String,
        trim: true
    },
    qualityCheck: {
        passed: {
            type: Boolean,
            default: false
        },
        score: {
            type: Number,
            min: 0,
            max: 100
        },
        comments: {
            type: String,
            trim: true
        }
    }
}, {
    timestamps: true
});
// Index for better query performance
ProcessRecordSchema.index({ partId: 1, processLineNumber: 1 });
ProcessRecordSchema.index({ workerId: 1, status: 1 });
exports.ProcessRecord = mongoose_1.default.model('ProcessRecord', ProcessRecordSchema);
