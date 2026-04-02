export class AlertServiceError extends Error {
  statusCode: number;
  errorCode: string;
  data?: unknown;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    data?: unknown;
  }) {
    super(options.message);
    this.name = "AlertServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }

  /** Alias for controllers that checked `error.code` */
  get code(): string {
    return this.errorCode;
  }
}
