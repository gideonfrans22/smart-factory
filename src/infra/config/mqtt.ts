import * as mqtt from "mqtt";
import * as dotenv from "dotenv";
import { loggerService } from "@shared/services";

dotenv.config({ quiet: true });

interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId: string;
  topicPrefix: string;
}

class MQTTService {
  private client: mqtt.MqttClient | null = null;
  private config: MQTTConfig;

  private normalizePrefix(prefix: string): string {
    return prefix.replace(/^\/+|\/+$/g, "");
  }

  private isPrefixedTopic(topic: string): boolean {
    return (
      topic === this.config.topicPrefix ||
      topic.startsWith(`${this.config.topicPrefix}/`)
    );
  }

  private applyTopicPrefix(topic: string): string {
    if (!topic) return this.config.topicPrefix;
    if (this.isPrefixedTopic(topic)) return topic;
    return `${this.config.topicPrefix}/${topic.replace(/^\/+/, "")}`;
  }

  private stripTopicPrefix(topic: string): string {
    if (!this.isPrefixedTopic(topic)) return topic;
    if (topic === this.config.topicPrefix) return "";
    return topic.substring(this.config.topicPrefix.length + 1);
  }

  private topicMatches(
    subscriptionTopic: string,
    receivedTopic: string
  ): boolean {
    const escaped = subscriptionTopic.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/\\\+/g, "[^/]+").replace(/\\#/g, ".*");
    return new RegExp(`^${pattern}$`).test(receivedTopic);
  }

  constructor() {
    const topicPrefix = this.normalizePrefix(
      process.env.MQTT_TOPIC_PREFIX || "dev"
    );
    this.config = {
      brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      // Ensure clientId is UNIQUE per process, especially important in cluster mode.
      // If multiple clients connect with the same clientId, the broker will drop
      // the previous connection, causing ECONNRESET errors.
      clientId: `${process.env.MQTT_CLIENT_ID || "smart_factory_backend"}-${
        process.pid
      }`,
      topicPrefix
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
          loggerService.info("MQTT namespace configured", {
            brokerUrl: this.config.brokerUrl,
            topicPrefix: this.config.topicPrefix
          });
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
    const prefixedTopic = this.applyTopicPrefix(topic);

    this.client.publish(prefixedTopic, payload, { qos: 1 }, (error) => {
      if (error) {
        loggerService.logMQTTEvent(
          "Publish error",
          prefixedTopic,
          payload,
          error
        );
      } else {
        loggerService.logMQTTEvent("Published", prefixedTopic, payload);
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

    const prefixedTopic = this.applyTopicPrefix(topic);
    this.client.subscribe(prefixedTopic, { qos: 1 }, (error) => {
      if (error) {
        loggerService.logMQTTEvent(
          "Subscribe error",
          prefixedTopic,
          undefined,
          error
        );
      } else {
        loggerService.logMQTTEvent("Subscribed", prefixedTopic);
      }
    });

    this.client.on("message", (receivedTopic, message) => {
      if (this.topicMatches(prefixedTopic, receivedTopic)) {
        const unprefixedTopic = this.stripTopicPrefix(receivedTopic);
        loggerService.debug(`MQTT Message received: ${prefixedTopic}`, {
          payload: message.toString().substring(0, 200)
        });
        callback(unprefixedTopic, message.toString());
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
