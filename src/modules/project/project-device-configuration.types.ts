/**
 * Wire format: keys are device type ids (ObjectId hex strings), values are ordered device id strings.
 */
export type DeviceConfigurationByDeviceType = Record<string, string[]>;

export interface RequiredDeviceTypeRef {
  deviceTypeId: string;
  name: string;
}

/** GET /projects/:id/device-configuration — always 200; empty doc => `{ byDeviceType: {} }`. */
export interface ProjectDeviceConfigurationGetResponse {
  byDeviceType: DeviceConfigurationByDeviceType;
  requiredDeviceTypes: RequiredDeviceTypeRef[];
}

/** PUT /projects/:id/device-configuration — full replace of `byDeviceType`. */
export interface ProjectDeviceConfigurationPutBody {
  byDeviceType: DeviceConfigurationByDeviceType;
}

/** DELETE /projects/:id/device-configuration */
export interface ProjectDeviceConfigurationDeleteResponse {
  message: string;
}

/** Standard API error body: `{ statusCode, errorCode, message }`. */
export interface StructuredApiErrorBody {
  statusCode: number;
  errorCode: string;
  message: string;
}

export function createStructuredApiErrorBody(
  statusCode: number,
  errorCode: string,
  message: string
): StructuredApiErrorBody {
  return { statusCode, errorCode, message };
}

/** Stable backend codes for device configuration (see implementation doc). */
export const DeviceConfigurationErrorCode = {
  INCOMPLETE: "DEVICE_CONFIGURATION_INCOMPLETE",
  INVALID_DEVICE: "DEVICE_CONFIGURATION_INVALID_DEVICE",
  DEVICE_TYPE_MISMATCH: "DEVICE_CONFIGURATION_DEVICE_TYPE_MISMATCH",
  DUPLICATE_DEVICE: "DEVICE_CONFIGURATION_DUPLICATE_DEVICE",
  INACTIVE_DEVICE: "DEVICE_CONFIGURATION_INACTIVE_DEVICE",
  DELETED_DEVICE: "DEVICE_CONFIGURATION_DELETED_DEVICE",
  NOT_IN_PLANNING: "PROJECT_NOT_IN_PLANNING",
  MISSING_STEP_DEVICE_TYPE: "MISSING_STEP_DEVICE_TYPE",
  INVALID_PAYLOAD: "DEVICE_CONFIGURATION_INVALID_PAYLOAD",
  NOT_FOUND: "NOT_FOUND"
} as const;
