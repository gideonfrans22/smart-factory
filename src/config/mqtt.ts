import * as mqtt from "mqtt";
import * as dotenv from "dotenv";
import { loggerService } from "@shared/services";

dotenv.config();

interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId: string;
}

class MQTTService {
  private client: mqtt.MqttClient | null = null;
  private config: MQTTConfig;

  constructor() {
    this.config = {
      brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      // Ensure clientId is UNIQUE per process, especially important in cluster mode.
      // If multiple clients connect with the same clientId, the broker will drop
      // the previous connection, causing ECONNRESET errors.
      clientId: `${process.env.MQTT_CLIENT_ID || "smart_factory_backend"}-${
        process.pid
      }`
    };
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const options: mqtt.IClientOptions = {
          clientId: this.config.clientId,
          clean: true,
          connectTimeout: 4000,
          username: this.config.username,
          password: this.config.password,
          reconnectPeriod: 1000
        };

        this.client = mqtt.connect(this.config.brokerUrl, options);

        this.client.on("connect", () => {
          loggerService.logMQTTEvent("Connected to broker");
          resolve();
        });

        this.client.on("error", (error) => {
          loggerService.logMQTTEvent(
            "Connection error",
            undefined,
            undefined,
            error
          );
          reject(error);
        });

        this.client.on("offline", () => {
          loggerService.logMQTTEvent("Client offline");
        });

        this.client.on("reconnect", () => {
          loggerService.logMQTTEvent("Reconnecting");
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.client) {
      this.client.end();
      loggerService.logMQTTEvent("Disconnected");
    }
  }

  public publish(topic: string, message: string | object): void {
    if (!this.client || !this.client.connected) {
      loggerService.logMQTTEvent(
        "Publish failed - Client not connected",
        topic
      );
      return;
    }

    const payload =
      typeof message === "string" ? message : JSON.stringify(message);

    this.client.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) {
        loggerService.logMQTTEvent("Publish error", topic, payload, error);
      } else {
        loggerService.logMQTTEvent("Published", topic, payload);
      }
    });
  }

  public subscribe(
    topic: string,
    callback: (topic: string, message: string) => void
  ): void {
    if (!this.client || !this.client.connected) {
      loggerService.logMQTTEvent(
        "Subscribe failed - Client not connected",
        topic
      );
      return;
    }

    this.client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        loggerService.logMQTTEvent("Subscribe error", topic, undefined, error);
      } else {
        loggerService.logMQTTEvent("Subscribed", topic);
      }
    });

    this.client.on("message", (receivedTopic, message) => {
      if (receivedTopic === topic) {
        loggerService.debug(`MQTT Message received: ${topic}`, {
          payload: message.toString().substring(0, 200)
        });
        callback(receivedTopic, message.toString());
      }
    });
  }

  public isConnected(): boolean {
    return this.client ? this.client.connected : false;
  }
}

// Export singleton instance
export const mqttService = new MQTTService();

// MQTT Topics for the smart factory
export const MQTT_TOPICS = {
  PROCESS_LINE_STATUS: "factory/process-line/status",
  PART_PROGRESS: "factory/part/progress",
  WORKER_ACTION: "factory/worker/action",
  MANAGER_COMMAND: "factory/manager/command",
  SYSTEM_ALERTS: "factory/system/alerts",
  PRODUCTION_METRICS: "factory/metrics/production"
} as const;
