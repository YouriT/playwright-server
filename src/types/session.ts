import { BrowserContext } from 'patchright';
import { RecordingMetadata } from './recording';
import { ProxyConfig } from './proxy';

export interface SessionData {
  id: string;
  ttl: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  browserContext: BrowserContext;
  timeoutHandle: NodeJS.Timeout;
  recordingMetadata: RecordingMetadata | null;
  proxyConfig: ProxyConfig | null;
}
