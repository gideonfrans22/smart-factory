import { Request, Response } from "express";
import { KPIData } from "../models/KPIData";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import { Alert } from "../models/Alert";
import { APIResponse } from "../types";

export const getRealtimeKPI = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get counts
    const activeProjects = await Project.countDocuments({ status: "ACTIVE" });
    const completedTasks = await Task.countDocuments({ status: "COMPLETED" });
    const pendingTasks = await Task.countDocuments({ status: "PENDING" });
    const emergencyAlerts = await Alert.countDocuments({
      type: "EMERGENCY",
      status: "PENDING"
    });

    // Calculate rates from recent KPI data (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentKPI = await KPIData.find({
      recordedAt: { $gte: oneDayAgo }
    }).sort({ recordedAt: -1 });

    // Calculate averages
    let onTimeRate = 0;
    let defectRate = 0;
    let productivity = 0;
    let equipmentUptime = 0;

    if (recentKPI.length > 0) {
      const onTimeRateData = recentKPI.filter(
        (k) => k.metricName === "onTimeRate"
      );
      const defectRateData = recentKPI.filter(
        (k) => k.metricName === "defectRate"
      );
      const productivityData = recentKPI.filter(
        (k) => k.metricName === "productivity"
      );
      const uptimeData = recentKPI.filter(
        (k) => k.metricName === "equipmentUptime"
      );

      onTimeRate =
        onTimeRateData.length > 0
          ? onTimeRateData.reduce((sum, k) => sum + k.metricValue, 0) /
            onTimeRateData.length
          : 85;
      defectRate =
        defectRateData.length > 0
          ? defectRateData.reduce((sum, k) => sum + k.metricValue, 0) /
            defectRateData.length
          : 2.5;
      productivity =
        productivityData.length > 0
          ? productivityData.reduce((sum, k) => sum + k.metricValue, 0) /
            productivityData.length
          : 92;
      equipmentUptime =
        uptimeData.length > 0
          ? uptimeData.reduce((sum, k) => sum + k.metricValue, 0) /
            uptimeData.length
          : 95;
    } else {
      // Default values if no data
      onTimeRate = 85;
      defectRate = 2.5;
      productivity = 92;
      equipmentUptime = 95;
    }

    // Generate trend data (last 24 hours, hourly)
    const trends = [];
    for (let i = 23; i >= 0; i--) {
      const hourAgo = new Date(Date.now() - i * 60 * 60 * 1000);
      trends.push({
        timestamp: hourAgo.toISOString(),
        onTimeRate: onTimeRate + (Math.random() * 10 - 5),
        defectRate: Math.max(0, defectRate + (Math.random() * 2 - 1)),
        productivity: productivity + (Math.random() * 10 - 5),
        equipmentUptime: equipmentUptime + (Math.random() * 5 - 2.5)
      });
    }

    const response: APIResponse = {
      success: true,
      message: "Real-time KPI data retrieved successfully",
      data: {
        timestamp: new Date().toISOString(),
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        defectRate: Math.round(defectRate * 100) / 100,
        productivity: Math.round(productivity * 100) / 100,
        equipmentUptime: Math.round(equipmentUptime * 100) / 100,
        activeProjects,
        completedTasks,
        pendingTasks,
        emergencyAlerts,
        trends
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get realtime KPI error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const createKPIData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { metricName, metricValue, unit, deviceId, projectId, metadata } =
      req.body;

    if (!metricName || metricValue === undefined) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Metric name and value are required"
      };
      res.status(400).json(response);
      return;
    }

    const kpiData = new KPIData({
      metricName,
      metricValue,
      unit,
      deviceId,
      projectId,
      metadata,
      recordedAt: new Date()
    });

    await kpiData.save();

    const response: APIResponse = {
      success: true,
      message: "KPI data created successfully",
      data: kpiData
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create KPI data error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
