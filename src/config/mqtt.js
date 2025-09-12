"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTT_TOPICS = exports.mqttService = void 0;
var mqtt = require("mqtt");
var dotenv = require("dotenv");
dotenv.config();
var MQTTService = /** @class */ (function () {
    function MQTTService() {
        this.client = null;
        this.config = {
            brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clientId: process.env.MQTT_CLIENT_ID || 'smart_factory_backend'
        };
    }
    MQTTService.prototype.connect = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                var options = {
                    clientId: _this.config.clientId,
                    clean: true,
                    connectTimeout: 4000,
                    username: _this.config.username,
                    password: _this.config.password,
                    reconnectPeriod: 1000,
                };
                _this.client = mqtt.connect(_this.config.brokerUrl, options);
                _this.client.on('connect', function () {
                    console.log('✅ MQTT Connected to broker');
                    resolve();
                });
                _this.client.on('error', function (error) {
                    console.error('❌ MQTT Connection error:', error);
                    reject(error);
                });
                _this.client.on('offline', function () {
                    console.log('📴 MQTT Client offline');
                });
                _this.client.on('reconnect', function () {
                    console.log('🔄 MQTT Reconnecting...');
                });
            }
            catch (error) {
                reject(error);
            }
        });
    };
    MQTTService.prototype.disconnect = function () {
        if (this.client) {
            this.client.end();
            console.log('📤 MQTT Disconnected');
        }
    };
    MQTTService.prototype.publish = function (topic, message) {
        if (!this.client || !this.client.connected) {
            console.error('❌ MQTT Client not connected');
            return;
        }
        var payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.client.publish(topic, payload, { qos: 1 }, function (error) {
            if (error) {
                console.error("\u274C MQTT Publish error for topic ".concat(topic, ":"), error);
            }
            else {
                console.log("\uD83D\uDCE4 MQTT Published to ".concat(topic, ":"), payload);
            }
        });
    };
    MQTTService.prototype.subscribe = function (topic, callback) {
        if (!this.client || !this.client.connected) {
            console.error('❌ MQTT Client not connected');
            return;
        }
        this.client.subscribe(topic, { qos: 1 }, function (error) {
            if (error) {
                console.error("\u274C MQTT Subscribe error for topic ".concat(topic, ":"), error);
            }
            else {
                console.log("\uD83D\uDCE5 MQTT Subscribed to ".concat(topic));
            }
        });
        this.client.on('message', function (receivedTopic, message) {
            if (receivedTopic === topic) {
                callback(receivedTopic, message.toString());
            }
        });
    };
    MQTTService.prototype.isConnected = function () {
        return this.client ? this.client.connected : false;
    };
    return MQTTService;
}());
// Export singleton instance
exports.mqttService = new MQTTService();
// MQTT Topics for the smart factory
exports.MQTT_TOPICS = {
    PROCESS_LINE_STATUS: 'factory/process-line/status',
    PART_PROGRESS: 'factory/part/progress',
    WORKER_ACTION: 'factory/worker/action',
    MANAGER_COMMAND: 'factory/manager/command',
    SYSTEM_ALERTS: 'factory/system/alerts',
    PRODUCTION_METRICS: 'factory/metrics/production'
};
