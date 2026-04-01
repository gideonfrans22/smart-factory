export class RawMaterialTypeServiceError extends Error {
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
    this.name = "RawMaterialTypeServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}
