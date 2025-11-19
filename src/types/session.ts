import { BrowserContext } from 'patchright';
import { RecordingMetadata } from './recording';

export interface SessionData {
  id: string;
  ttl: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  browserContext: BrowserContext;
  timeoutHandle: NodeJS.Timeout;
  recordingMetadata: RecordingMetadata | null;
}
