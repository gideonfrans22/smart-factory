export class TaskDomainError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly data?: unknown;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    data?: unknown;
  }) {
    super(options.message);
    this.name = "TaskDomainError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}
