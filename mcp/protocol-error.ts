export class McpProtocolError extends Error {
  readonly rpcCode: number;

  constructor(rpcCode: number, message: string) {
    super(message);
    this.rpcCode = rpcCode;
  }
}
