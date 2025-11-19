export interface CommandRequest {
  command: string;
  selector?: string;
  options?: Record<string, any>;
}

export interface CommandResponse {
  result: any;
  executedAt: Date;
}
