import { SessionData } from '../types/session';
import { cleanupSession } from '../services/session';

export function resetSessionTTL(session: SessionData): void {
  // Clear old timeout
  clearTimeout(session.timeoutHandle);

  // Update timestamps
  const now = new Date();
  session.lastActivityAt = now;
  session.expiresAt = new Date(now.getTime() + session.ttl);

  // Create new timeout
  session.timeoutHandle = setTimeout(() => {
    cleanupSession(session.id);
  }, session.ttl);
}
