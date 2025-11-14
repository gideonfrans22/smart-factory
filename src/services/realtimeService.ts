import { mqttService, MQTT_TOPICS } from "../config/mqtt";
import { getIO } from "../config/websocket";
import { Alert, Task, Device } from "../models";
import { ITask } from "../models/Task";
import { IAlert } from "../models/Alert";
import { IProject } from "../models/Project";
import { IKPIData } from "../models/KPIData";

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
      console.log("⚠️ MQTT handlers already initialized");
      return;
    }

    if (!mqttService.isConnected()) {
      console.log("⚠️ MQTT not connected, skipping handler initialization");
      return;
    }

    console.log("📡 Initializing MQTT message handlers...");

    // --- Device Alert Handler ---
    mqttService.subscribe("device/+/alert", async (topic, message) => {
      try {
        const deviceId = topic.split("/")[1];
        const alertData = JSON.parse(message);

        console.log(`🚨 MQTT Alert received from device ${deviceId}`);

        // Save alert to database
        const alert = await Alert.create({
          deviceId,
          type: alertData.alertType || alertData.type || "INFO",
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

        console.log(`📤 Alert broadcasted via WebSocket: ${alert._id}`);
      } catch (error) {
        console.error("❌ Error processing device alert:", error);
      }
    });

    // --- Task Progress Handler ---
    mqttService.subscribe("task/+/progress", async (topic, message) => {
      try {
        const taskId = topic.split("/")[1];
        const progressData = JSON.parse(message);

        console.log(`📊 MQTT Task progress update: ${taskId}`);

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

          console.log(
            `📤 Task progress broadcasted: ${taskId} - ${task.progress}%`
          );
        }
      } catch (error) {
        console.error("❌ Error processing task progress:", error);
      }
    });

    // --- Device Status Handler ---
    mqttService.subscribe("device/+/status", async (topic, message) => {
      try {
        const deviceId = topic.split("/")[1];
        const statusData = JSON.parse(message);

        console.log(`📡 MQTT Device status update: ${deviceId}`);

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

        console.log(`📤 Device status broadcasted: ${deviceId}`);
      } catch (error) {
        console.error("❌ Error processing device status:", error);
      }
    });

    // --- Device Metrics Handler ---
    mqttService.subscribe("device/+/metrics", async (topic, message) => {
      try {
        const deviceId = topic.split("/")[1];
        const metricsData = JSON.parse(message);

        console.log(`📊 MQTT Device metrics: ${deviceId}`);

        // Broadcast metrics to WebSocket (for real-time charts)
        const io = getIO();
        io.to(`device:${deviceId}`).emit("device:metrics", {
          deviceId,
          metrics: metricsData,
          timestamp: new Date().toISOString()
        });

        console.log(`📤 Device metrics broadcasted: ${deviceId}`);
      } catch (error) {
        console.error("❌ Error processing device metrics:", error);
      }
    });

    // --- Task Completion Handler (from devices/workers) ---
    mqttService.subscribe("task/+/completed", async (topic, message) => {
      try {
        const taskId = topic.split("/")[1];
        const completionData = JSON.parse(message);

        console.log(`✅ MQTT Task completion signal: ${taskId}`);

        // Note: Actual task completion logic stays in taskController
        // This is just for device-initiated completions
        // Broadcast notification
        const io = getIO();
        io.to(`task:${taskId}`).emit("task:completed:signal", {
          taskId,
          ...completionData
        });

        console.log(`📤 Task completion signal broadcasted: ${taskId}`);
      } catch (error) {
        console.error("❌ Error processing task completion:", error);
      }
    });

    this.mqttInitialized = true;
    console.log("✅ MQTT message handlers initialized");
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

      console.log(`📤 Task assignment broadcasted: ${task._id}`);
    } catch (error) {
      console.error("❌ Error broadcasting task assignment:", error);
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

      // Broadcast via WebSocket
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
        io.to(`devicetype:${deviceTypeId}`).emit(
          "devicetype:task:status",
          payload
        );
      }

      console.log(
        `📤 Task status change broadcasted: ${task._id} - ${task.status}`
      );
    } catch (error) {
      console.error("❌ Error broadcasting task status:", error);
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

      console.log(`📤 Task completion broadcasted: ${task._id}`);
    } catch (error) {
      console.error("❌ Error broadcasting task completion:", error);
    }
  }

  /**
   * Broadcast project status/progress update
   */
  public async broadcastProjectUpdate(project: IProject): Promise<void> {
    try {
      const io = getIO();

      const payload = {
        projectId: project._id?.toString(),
        status: project.status,
        progress: project.progress,
        product: project.product,
        recipe: project.recipe,
        producedQuantity: project.producedQuantity,
        targetQuantity: project.targetQuantity,
        updatedAt: project.updatedAt
      };

      // Publish to MQTT
      mqttService.publish(`project/${project._id}/status`, payload);

      // Broadcast via WebSocket
      io.to(`project:${project._id}`).emit("project:updated", payload);
      io.to("global").emit("project:updated", payload);

      console.log(
        `📤 Project update broadcasted: ${project._id} - ${project.status}`
      );
    } catch (error) {
      console.error("❌ Error broadcasting project update:", error);
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

      console.log(`📤 Alert broadcasted: ${alert._id} - ${alert.level}`);
    } catch (error) {
      console.error("❌ Error broadcasting alert:", error);
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

      console.log(
        `📤 KPI update broadcasted: ${kpiData.metricName} - ${kpiData.metricValue}`
      );
    } catch (error) {
      console.error("❌ Error broadcasting KPI update:", error);
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

      console.log(`📤 System announcement broadcasted: ${message}`);
    } catch (error) {
      console.error("❌ Error broadcasting announcement:", error);
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

        console.log(
          `📤 Task generation broadcasted to DeviceType ${deviceTypeId}: ${deviceTypeTasks.length} tasks`
        );
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

      console.log(
        `📤 Task generation summary broadcasted: ${tasks.length} total tasks for ${tasksByDeviceType.size} device types`
      );
    } catch (error) {
      console.error("❌ Error broadcasting task generation:", error);
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
