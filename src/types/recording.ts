export interface RecordingMetadata {
  enabled: boolean;
  playbackUrl: string;
  filePath: string;
  startedAt: Date;
  size?: {
    width: number;
    height: number;
  };
}
