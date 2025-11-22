export interface CommandRequest {
  command: string;
  selector?: string;
  options?: Record<string, any>;
}

export interface CommandResponse {
  result: any;
  executedAt: Date;
}

// New types for command sequence execution
export type CommandSequenceRequest = CommandRequest | CommandRequest[];

export interface CommandExecutionResult {
  index: number;
  command: string;
  status: 'success' | 'error';
  result: any;
  durationMs: number;
  error?: string;
  selector?: string;
}

export interface SequenceExecutionResponse {
  results: CommandExecutionResult[];
  completedCount: number;
  totalCount: number;
  halted: boolean;
  executedAt: string;
}

export interface SessionLogEntry {
  timestamp: string;
  correlationId: string;
  sessionId: string;
  command: string;
  index: number;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
  selector?: string;
  params?: Record<string, any>; // Sanitized command parameters
  metadata?: {
    userAgent?: string;
    currentUrl?: string;
    totalCommands?: number;
  };
}
