import { mqttService, MQTT_TOPICS } from '../config/mqtt';
import { ProcessRecord } from '../models/ProcessRecord';
import { Part } from '../models/Part';
import { ProcessLine } from '../models/ProcessLine';
import { User } from '../models/User';
import { 
  ProcessLineStatus, 
  PartProgress, 
  WorkerAction, 
  ProductionMetrics 
} from '../types';

class MonitoringService {
  public async initializeMonitoring(): Promise<void> {
    // Subscribe to worker actions
    mqttService.subscribe(MQTT_TOPICS.WORKER_ACTION, this.handleWorkerAction.bind(this));
    
    // Subscribe to manager commands
    mqttService.subscribe(MQTT_TOPICS.MANAGER_COMMAND, this.handleManagerCommand.bind(this));
    
    console.log('🔍 Monitoring service initialized');
  }

  private async handleWorkerAction(topic: string, message: string): Promise<void> {
    try {
      const action: WorkerAction = JSON.parse(message);
      console.log('Worker action received:', action);

      // Process the worker action
      await this.processWorkerAction(action);
      
      // Broadcast updated status
      await this.broadcastProcessLineStatus(action.processLineNumber);
      await this.broadcastPartProgress(action.partId);
      
    } catch (error) {
      console.error('Error handling worker action:', error);
    }
  }

  private async handleManagerCommand(topic: string, message: string): Promise<void> {
    try {
      const command = JSON.parse(message);
      console.log('Manager command received:', command);
      
      // Handle different manager commands (part assignment, process line config, etc.)
      // Implementation depends on command type
      
    } catch (error) {
      console.error('Error handling manager command:', error);
    }
  }

  private async processWorkerAction(action: WorkerAction): Promise<void> {
    const { workerId, processLineNumber, partId, action: actionType } = action;

    // Find existing process record or create new one
    let processRecord = await ProcessRecord.findOne({
      partId,
      processLineNumber,
      status: { $in: ['queued', 'started', 'paused'] }
    });

    const part = await Part.findOne({ partId });
    if (!part) {
      throw new Error(`Part ${partId} not found`);
    }

    switch (actionType) {
      case 'start':
        if (!processRecord) {
          processRecord = new ProcessRecord({
            partId: part._id,
            processLineNumber,
            workerId,
            status: 'started',
            startTime: new Date()
          });
        } else {
          processRecord.status = 'started';
          processRecord.startTime = new Date();
        }
        
        // Update part status
        part.currentProcessLine = processLineNumber;
        part.currentStatus = 'in_progress';
        break;

      case 'complete':
        if (processRecord) {
          processRecord.status = 'completed';
          processRecord.endTime = new Date();
          
          // Calculate processing duration
          if (processRecord.startTime) {
            const duration = (new Date().getTime() - processRecord.startTime.getTime()) / (1000 * 60);
            processRecord.processingDuration = duration;
          }
        }
        
        // Move part to next process line or mark as completed
        await this.movePartToNextProcessLine(part);
        break;

      case 'pause':
        if (processRecord) {
          processRecord.status = 'paused';
        }
        part.currentStatus = 'on_hold';
        break;

      case 'resume':
        if (processRecord) {
          processRecord.status = 'started';
        }
        part.currentStatus = 'in_progress';
        break;

      case 'fail':
        if (processRecord) {
          processRecord.status = 'failed';
        }
        part.currentStatus = 'on_hold';
        break;
    }

    if (processRecord) {
      processRecord.notes = action.notes;
      await processRecord.save();
    }
    
    await part.save();
  }

  private async movePartToNextProcessLine(part: any): Promise<void> {
    const currentIndex = part.requiredProcessLines.indexOf(part.currentProcessLine);
    
    if (currentIndex < part.requiredProcessLines.length - 1) {
      // Move to next process line
      part.currentProcessLine = part.requiredProcessLines[currentIndex + 1];
      part.currentStatus = 'pending';
      
      // Create new process record for next line
      const nextProcessRecord = new ProcessRecord({
        partId: part._id,
        processLineNumber: part.currentProcessLine,
        status: 'queued'
      });
      await nextProcessRecord.save();
      
    } else {
      // Part completed all process lines
      part.currentProcessLine = undefined;
      part.currentStatus = 'completed';
      part.actualCompletionTime = new Date();
      
      // Calculate total processing time
      const processRecords = await ProcessRecord.find({ partId: part._id });
      const totalTime = processRecords.reduce((sum, record) => sum + (record.processingDuration || 0), 0);
      part.totalProcessingTime = totalTime;
    }
  }

  public async broadcastProcessLineStatus(lineNumber: number): Promise<void> {
    const status = await this.getProcessLineStatus(lineNumber);
    mqttService.publish(MQTT_TOPICS.PROCESS_LINE_STATUS, {
      lineNumber,
      ...status,
      timestamp: new Date()
    });
  }

  public async broadcastPartProgress(partId: string): Promise<void> {
    const progress = await this.getPartProgress(partId);
    mqttService.publish(MQTT_TOPICS.PART_PROGRESS, {
      partId,
      ...progress,
      timestamp: new Date()
    });
  }

  public async getProcessLineStatus(lineNumber: number): Promise<ProcessLineStatus> {
    const processLine = await ProcessLine.findOne({ lineNumber });
    if (!processLine) {
      throw new Error(`Process line ${lineNumber} not found`);
    }

    const partsInQueue = await ProcessRecord.countDocuments({
      processLineNumber: lineNumber,
      status: 'queued'
    });

    return {
      lineNumber,
      status: processLine.status,
      currentCapacity: processLine.currentCapacity,
      maxCapacity: processLine.maxCapacity,
      partsInQueue,
      averageProcessingTime: processLine.averageProcessingTime
    };
  }

  public async getPartProgress(partId: string): Promise<PartProgress> {
    const part = await Part.findOne({ partId });
    if (!part) {
      throw new Error(`Part ${partId} not found`);
    }

    const completedRecords = await ProcessRecord.find({
      partId: part._id,
      status: 'completed'
    });

    const completedProcessLines = completedRecords.map(record => record.processLineNumber);
    const remainingProcessLines = part.requiredProcessLines.filter(
      line => !completedProcessLines.includes(line)
    );

    const progressPercentage = Math.round(
      (completedProcessLines.length / part.requiredProcessLines.length) * 100
    );

    return {
      partId,
      currentProcessLine: part.currentProcessLine,
      completedProcessLines,
      remainingProcessLines,
      status: part.currentStatus,
      progressPercentage
    };
  }

  public async getProductionMetrics(): Promise<ProductionMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPartsProduced,
      totalPartsInProgress,
      dailyProduction,
      avgCompletionTime
    ] = await Promise.all([
      Part.countDocuments({ currentStatus: 'completed' }),
      Part.countDocuments({ currentStatus: { $in: ['pending', 'in_progress', 'on_hold'] } }),
      Part.countDocuments({ 
        currentStatus: 'completed',
        actualCompletionTime: { $gte: today }
      }),
      Part.aggregate([
        { $match: { currentStatus: 'completed', totalProcessingTime: { $gt: 0 } } },
        { $group: { _id: null, avgTime: { $avg: '$totalProcessingTime' } } }
      ])
    ]);

    // Calculate process line efficiency (simplified)
    const processLineEfficiency: { [lineNumber: number]: number } = {};
    for (let i = 1; i <= 20; i++) {
      const completedToday = await ProcessRecord.countDocuments({
        processLineNumber: i,
        status: 'completed',
        createdAt: { $gte: today }
      });
      processLineEfficiency[i] = completedToday; // Simplified metric
    }

    return {
      totalPartsProduced,
      totalPartsInProgress,
      dailyProduction,
      averageCompletionTime: avgCompletionTime[0]?.avgTime || 0,
      processLineEfficiency,
      workerPerformance: {} // To be implemented based on requirements
    };
  }
}

export const monitoringService = new MonitoringService();
