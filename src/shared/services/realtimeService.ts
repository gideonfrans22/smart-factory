import { mqttService, MQTT_TOPICS } from "../../config/mqtt";
import { getIO } from "../../config/websocket";
import { Alert, Task, Device, IDevice } from "../../models";
import { ITask } from "../../models/Task";
import { IAlert } from "../../models/Alert";
import { IProject } from "../../models/Project";
import { IKPIData } from "../../models/KPIData";
import { loggerService } from "./loggerService";

/**
 * RealtimeService - Central orchestrator for real-time updates
 * Bridges MQTT (devices) ↔ Backend ↔ WebSocket (dashboards)
 */
class RealtimeService {
  private mqttInitialized = false;

  /**
   * Initialize MQTT subscriptions to handle device messages
   * Call this once at server startup
   */
  public initializeMQTTHandlers(): void {
    if (this.mqttInitialized) {
      loggerService.warn("MQTT handlers already initialized");
      return;
    }

    if (!mqttService.isConnected()) {
      loggerService.warn("MQTT not connected, skipping handler initialization");
      return;
    }

    loggerService.info("Initializing MQTT message handlers...");

    // --- Device Alert Handler ---
    mqttService.subscribe("device/+/alert", async (topic, message) => {
      const deviceId = topic.split("/")[1];
      try {
        const alertData = JSON.parse(message);

        loggerService.info(`MQTT Alert received from device ${deviceId}`, { deviceId, alertType: alertData.alertType || alertData.type });

        // Save alert to database
        const alert = await Alert.create({
          deviceId,
          type: alertData.alertType || alertData.type || "OTHER",
          message: alertData.message,
          severity: alertData.severity || "LOW",
          metadata: alertData.sensorData || alertData.metadata || {},
          status: "ACTIVE"
        });

        // Broadcast to WebSocket clients
        const io = getIO();
        io.to("alerts").emit("alert:new", alert);
        io.to(`device:${deviceId}`).emit("device:alert", alert);
        io.to("global").emit("alert:new", alert);

        loggerService.info(`Alert broadcasted via WebSocket`, { alertId: alert._id?.toString(), deviceId });
      } catch (error) {
        loggerService.error("Error processing device alert", { error: (error as Error).message, deviceId, topic });
      }
    });

    // --- Task Progress Handler ---
    mqttService.subscribe("task/+/progress", async (topic, message) => {
      const taskId = topic.split("/")[1];
      try {
        const progressData = JSON.parse(message);

        loggerService.info(`MQTT Task progress update`, { taskId, progress: progressData.percentage || progressData.progress });

        // Update task progress in database
        const task = await Task.findByIdAndUpdate(
          taskId,
          {
            progress: progressData.percentage || progressData.progress,
            updatedAt: new Date()
          },
          { new: true }
        ).populate("deviceId projectId");

        if (task) {
          // Broadcast to WebSocket
          const io = getIO();
          io.to(`task:${taskId}`).emit("task:progress", {
            taskId: (task._id as any).toString(),
            progress: task.progress,
            status: task.status
          });

          if (task.projectId) {
            io.to(`project:${task.projectId}`).emit("task:progress", {
              taskId: (task._id as any).toString(),
              projectId: task.projectId,
              progress: task.progress
            });
          }

          loggerService.info(`Task progress broadcasted`, { taskId, progress: task.progress });
        }
      } catch (error) {
        loggerService.error("Error processing task progress", { error: (error as Error).message, taskId, topic });
      }
    });

    // --- Device Status Handler ---
    mqttService.subscribe("device/+/status", async (topic: string, message: any) => {
      const deviceId = topic.split("/")[1];
      try {
        const statusData = JSON.parse(message);

        loggerService.info(`MQTT Device status update`, { deviceId, status: statusData.status });

        // Update device in database
        await Device.findByIdAndUpdate(deviceId, {
          status: statusData.status,
          lastSeen: new Date(),
          metadata: {
            ...statusData.metadata,
            lastStatusUpdate: new Date().toISOString()
          }
        });

        // Broadcast to WebSocket
        const io = getIO();
        io.to(`device:${deviceId}`).emit("device:status", {
          deviceId,
          status: statusData.status,
          timestamp: new Date().toISOString(),
          ...statusData
        });

        io.to("global").emit("device:status", {
          deviceId,
          status: statusData.status,
          timestamp: new Date().toISOString()
        });

        loggerService.info(`Device status broadcasted`, { deviceId, status: statusData.status });
      } catch (error) {
        loggerService.error("Error processing device status", { error: (error as Error).message, deviceId, topic });
      }
    });

    // --- Device Metrics Handler ---
    mqttService.subscribe("device/+/metrics", async (topic: string, message: any) => {
      const deviceId = topic.split("/")[1];
      try {
        const metricsData = JSON.parse(message);

        loggerService.debug(`MQTT Device metrics`, { deviceId });

        // Broadcast metrics to WebSocket (for real-time charts)
        const io = getIO();
        io.to(`device:${deviceId}`).emit("device:metrics", {
          deviceId,
          metrics: metricsData,
          timestamp: new Date().toISOString()
        });

        loggerService.debug(`Device metrics broadcasted`, { deviceId });
      } catch (error) {
        loggerService.error("Error processing device metrics", { error: (error as Error).message, deviceId, topic });
      }
    });

    // --- Task Completion Handler (from devices/workers) ---
    mqttService.subscribe("task/+/completed", async (topic: string, message: any) => {
      const taskId = topic.split("/")[1];
      try {
        const completionData = JSON.parse(message);

        loggerService.info(`MQTT Task completion signal`, { taskId });

        // Note: Actual task completion logic stays in taskController
        // This is just for device-initiated completions
        // Broadcast notification
        const io = getIO();
        io.to(`task:${taskId}`).emit("task:completed:signal", {
          taskId,
          ...completionData
        });

        loggerService.info(`Task completion signal broadcasted`, { taskId });
      } catch (error) {
        loggerService.error("Error processing task completion", { error: (error as Error).message, taskId, topic });
      }
    });

    this.mqttInitialized = true;
    loggerService.info("MQTT message handlers initialized");
  }

  // --- Methods for Controllers to Call ---

  /**
   * Broadcast task assignment (called when task created/assigned)
   */
  public async broadcastTaskAssignment(task: ITask): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        taskId: task._id?.toString(),
        title: task.title,
        deviceTypeId: task.deviceTypeId,
        deviceId: task.deviceId,
        projectId: task.projectId,
        priority: task.priority || "NORMAL",
        status: task.status,
        estimatedDuration: task.estimatedDuration
      };

      // Publish to MQTT for devices
      if (task.deviceId) {
        mqttService.publish(`device/${task.deviceId}/task/assigned`, payload);
      }
      mqttService.publish(`task/${task._id}/assigned`, payload);

      // Broadcast via WebSocket
      if (task.deviceId) {
        io.to(`device:${task.deviceId}`).emit("task:assigned", payload);
      }
      if (task.projectId) {
        io.to(`project:${task.projectId}`).emit("task:assigned", payload);
      }
      io.to("global").emit("task:assigned", payload);

      loggerService.info(`Task assignment broadcasted`, { taskId: task._id?.toString(), deviceId: task.deviceId?.toString(), projectId: task.projectId?.toString() });
    } catch (error) {
      loggerService.error("Error broadcasting task assignment", { error: (error as Error).message, taskId: task._id?.toString() });
    }
  }

  /**
   * Broadcast task status change
   */
  public async broadcastTaskStatusChange(task: ITask): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        taskId: task._id?.toString(),
        status: task.status,
        deviceId: task.deviceId,
        deviceTypeId: task.deviceTypeId,
        workerId: task.workerId,
        projectId: task.projectId,
        updatedAt: task.updatedAt
      };

      // Publish to MQTT
      mqttService.publish(`task/${task._id}/status`, payload);
      if (task.deviceId) {
        const deviceId =
          task.deviceId._id || (task.deviceId as any)?.toString();
        mqttService.publish(`device/${deviceId}/task/status`, payload);
      }

      // Broadcast via WebSocket to global room (for admin/monitor dashboards)
      io.to("global").emit("task:status", payload);

      // Broadcast to specific rooms
      io.to(`task:${task._id}`).emit("task:status", payload);
      if (task.deviceId) {
        const deviceId =
          task.deviceId._id || (task.deviceId as any)?.toString();
        io.to(`device:${deviceId}`).emit("task:status", payload);
      }
      if (task.projectId) {
        const projectId =
          task.projectId._id || (task.projectId as any)?.toString();
        io.to(`project:${projectId}`).emit("task:status", payload);
      }
      if (task.deviceTypeId) {
        const deviceTypeId =
          task.deviceTypeId._id || (task.deviceTypeId as any)?.toString();
        loggerService.debug("Task status change", { taskId: task._id?.toString(), deviceTypeId, status: task.status });
        io.to(`devicetype:${deviceTypeId}`).emit(
          "devicetype:task:status",
          payload
        );
      }

      loggerService.info(`Task status change broadcasted`, { taskId: task._id?.toString(), status: task.status });
    } catch (error) {
      loggerService.error("Error broadcasting task status", { error: (error as Error).message, taskId: task._id?.toString() });
    }
  }

  /**
   * Broadcast task completion
   */
  public async broadcastTaskCompletion(
    task: ITask,
    nextTask?: ITask | null,
    projectProgress?: number
  ): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        taskId: task._id?.toString(),
        projectId: task.projectId,
        status: task.status,
        completedAt: task.completedAt,
        nextTaskId: nextTask?._id?.toString(),
        projectProgress
      };

      // Publish to MQTT
      mqttService.publish(`task/${task._id}/completed`, payload);
      if (task.deviceId) {
        mqttService.publish(`device/${task.deviceId}/task/completed`, payload);
      }

      // Broadcast via WebSocket
      io.to(`task:${task._id}`).emit("task:completed", payload);
      if (task.deviceId) {
        io.to(`device:${task.deviceId}`).emit("task:completed", payload);
      }
      if (task.projectId) {
        io.to(`project:${task.projectId}`).emit("task:completed", payload);
      }
      io.to("global").emit("task:completed", payload);

      loggerService.info(`Task completion broadcasted`, { taskId: task._id?.toString(), projectId: task.projectId?.toString() });
    } catch (error) {
      loggerService.error("Error broadcasting task completion", { error: (error as Error).message, taskId: task._id?.toString() });
    }
  }

  /**
   * Broadcast project progress update (when task completed)
   */
  public async broadcastProjectProgress(project: IProject): Promise<void> {
    const projectId = project._id?.toString();
    try {
      const io = getIO();

      const payload = {
        projectId,
        progress: project.progress,
        producedQuantity: project.producedQuantity,
        targetQuantity: project.targetQuantity,
        status: project.status,
        updatedAt: project.updatedAt
      };

      // Publish to MQTT
      mqttService.publish(`project/${projectId}/progress`, payload);

      // Broadcast via WebSocket
      io.to(`project:${projectId}`).emit("project:progress", payload);
      io.to("global").emit("project:progress", payload);

      loggerService.info(`Project progress broadcasted`, { projectId, progress: project.progress });
    } catch (error) {
      loggerService.error("Error broadcasting project progress", { error: (error as Error).message, projectId });
    }
  }

  /**
   * Broadcast project status/progress update
   */
  public async broadcastProjectUpdate(project: IProject): Promise<void> {
    const projectId = project._id?.toString();
    try {
      const io = getIO();

      const payload = {
        projectId,
        status: project.status,
        progress: project.progress,
        product: project.product,
        recipe: project.recipe,
        producedQuantity: project.producedQuantity,
        targetQuantity: project.targetQuantity,
        updatedAt: project.updatedAt
      };

      // Publish to MQTT
      mqttService.publish(`project/${projectId}/status`, payload);

      // Broadcast via WebSocket
      io.to(`project:${projectId}`).emit("project:updated", payload);
      io.to("global").emit("project:updated", payload);

      loggerService.info(`Project update broadcasted`, { projectId, status: project.status });
    } catch (error) {
      loggerService.error("Error broadcasting project update", { error: (error as Error).message, projectId });
    }
  }

  /**
   * Broadcast new alert
   */
  public async broadcastAlert(alert: IAlert): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        alertId: alert._id?.toString(),
        type: alert.type,
        level: alert.level,
        title: alert.title,
        message: alert.message,
        status: alert.status,
        relatedEntityType: alert.relatedEntityType,
        relatedEntityId: alert.relatedEntityId,
        timestamp: alert.createdAt
      };

      // Publish to MQTT
      mqttService.publish(MQTT_TOPICS.SYSTEM_ALERTS, payload);

      // Broadcast via WebSocket
      io.to("alerts").emit("alert:new", payload);
      io.to("global").emit("alert:new", payload);

      loggerService.info(`Alert broadcasted`, { alertId: alert._id?.toString(), level: alert.level, type: alert.type });
    } catch (error) {
      loggerService.error("Error broadcasting alert", { error: (error as Error).message, alertId: alert._id?.toString() });
    }
  }

  /**
   * Broadcast KPI update
   */
  public async broadcastKPIUpdate(kpiData: IKPIData): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        kpiId: kpiData._id?.toString(),
        metricName: kpiData.metricName,
        metricValue: kpiData.metricValue,
        unit: kpiData.unit,
        recordedAt: kpiData.recordedAt,
        metadata: kpiData.metadata
      };

      // Publish to MQTT
      mqttService.publish(MQTT_TOPICS.PRODUCTION_METRICS, payload);

      // Broadcast via WebSocket
      io.to("kpis").emit("kpi:update", payload);
      io.to("global").emit("kpi:update", payload);

      loggerService.info(`KPI update broadcasted`, { kpiId: kpiData._id?.toString(), metricName: kpiData.metricName, metricValue: kpiData.metricValue });
    } catch (error) {
      loggerService.error("Error broadcasting KPI update", { error: (error as Error).message, kpiId: kpiData._id?.toString() });
    }
  }

  public async broadcastDeviceUpdate(device: IDevice): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        deviceId: device._id?.toString(),
        name: device.name,
        status: device.status,
        currentUser: device.currentUser,
        deviceTypeId: device.deviceTypeId,
        lastHeartbeat: device.lastHeartbeat
      };

      // Publish to MQTT
      mqttService.publish(`device/${device._id}/updated`, payload);

      // Broadcast via WebSocket
      io.to(`device:${device._id}`).emit("device:updated", payload);
      io.to("global").emit("device:updated", payload);
      loggerService.info(`Device update broadcasted`, { deviceId: device._id?.toString(), status: device.status });
    } catch (error) {
      loggerService.error("Error broadcasting device update", { error: (error as Error).message, deviceId: device._id?.toString() });
    }
  }

  /**
   * Broadcast system-wide announcement
   */
  public async broadcastAnnouncement(
    message: string,
    data?: any
  ): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        message,
        data,
        timestamp: new Date().toISOString()
      };

      // Publish to MQTT
      mqttService.publish("system/broadcast", payload);

      // Broadcast via WebSocket
      io.to("global").emit("system:announcement", payload);

      loggerService.info(`System announcement broadcasted`, { message });
    } catch (error) {
      loggerService.error("Error broadcasting announcement", { error: (error as Error).message });
    }
  }

  /**
   * Broadcast bulk task generation notifications to device types
   * Called when project is activated and tasks are auto-generated
   */
  public async broadcastTasksGeneratedForDeviceTypes(
    tasks: any[],
    projectId: string,
    projectName: string
  ): Promise<void> {
    try {
      const io = getIO();

      // Group tasks by deviceTypeId
      const tasksByDeviceType = new Map<string, any[]>();

      tasks.forEach((task) => {
        if (!task.deviceTypeId) return;

        const deviceTypeId = task.deviceTypeId.toString();
        if (!tasksByDeviceType.has(deviceTypeId)) {
          tasksByDeviceType.set(deviceTypeId, []);
        }
        tasksByDeviceType.get(deviceTypeId)!.push(task);
      });

      // Broadcast to each device type
      for (const [
        deviceTypeId,
        deviceTypeTasks
      ] of tasksByDeviceType.entries()) {
        const payload = {
          deviceTypeId,
          projectId,
          projectName,
          taskCount: deviceTypeTasks.length,
          tasks: deviceTypeTasks.map((t) => ({
            taskId: t._id?.toString(),
            title: t.title,
            priority: t.priority,
            estimatedDuration: t.estimatedDuration,
            status: t.status,
            recipeExecutionNumber: t.recipeExecutionNumber,
            totalRecipeExecutions: t.totalRecipeExecutions
          })),
          timestamp: new Date().toISOString()
        };

        // Publish to MQTT for devices of this type
        mqttService.publish(`devicetype/${deviceTypeId}/tasks/new`, payload);

        // Broadcast via WebSocket to deviceType room
        io.to(`devicetype:${deviceTypeId}`).emit(
          "devicetype:tasks:new",
          payload
        );

        loggerService.info(`Task generation broadcasted to DeviceType`, { deviceTypeId, taskCount: deviceTypeTasks.length, projectId });
      }

      // Also broadcast summary to global/project rooms
      const summaryPayload = {
        projectId,
        projectName,
        totalTasks: tasks.length,
        deviceTypeBreakdown: Array.from(tasksByDeviceType.entries()).map(
          ([deviceTypeId, tasks]) => ({
            deviceTypeId,
            taskCount: tasks.length
          })
        ),
        timestamp: new Date().toISOString()
      };

      io.to(`project:${projectId}`).emit(
        "project:tasks:generated",
        summaryPayload
      );
      io.to("global").emit("project:tasks:generated", summaryPayload);

      loggerService.info(`Task generation summary broadcasted`, { totalTasks: tasks.length, deviceTypeCount: tasksByDeviceType.size, projectId });
    } catch (error) {
      loggerService.error("Error broadcasting task generation", { error: (error as Error).message, projectId });
    }
  }

  /**
   * Emit layout monitor display toggle event
   * Notifies monitor TV when admin toggles isMonitorDisplay
   */
  public emitLayoutMonitorDisplayToggled(data: {
    layoutId: string;
    layoutName: string;
    isMonitorDisplay: boolean;
    previousValue: boolean;
    timestamp: number;
  }): void {
    try {
      const io = getIO();

      // Broadcast to monitor displays
      io.to("monitors").emit("layout:monitorDisplayToggled", data);

      // Also broadcast to global for admin dashboards
      io.to("global").emit("layout:monitorDisplayToggled", data);

      loggerService.info(`Layout monitor display toggled`, { layoutId: data.layoutId, layoutName: data.layoutName, isMonitorDisplay: data.isMonitorDisplay });
    } catch (error) {
      loggerService.error("Error emitting layout monitor display toggle", { error: (error as Error).message, layoutId: data.layoutId });
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
