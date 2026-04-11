export type VideoCodec = 'h264' | 'h265' | 'vp9' | 'av1';

export type StreamingProtocol = 'HLS' | 'DASH' | 'RTMP';

export type QualityTier = '360p' | '720p' | '1080p' | '4k';

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: VideoCodec;
  bitrate: number;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscodingProfile {
  id: string;
  name: string;
  codec: VideoCodec;
  quality: QualityTier;
  resolution: { width: number; height: number };
  bitrate: number;
  fps: number;
}

export interface AdaptiveBitrateConfig {
  enabled: boolean;
  profiles: TranscodingProfile[];
  switchStrategy: 'bandwidth' | 'device' | 'manual';
  minBitrate: number;
  maxBitrate: number;
}

export interface CDNEndpoint {
  id: string;
  url: string;
  region: string;
  priority: number;
  healthy: boolean;
}

export interface VideoStorage {
  id: string;
  provider: string;
  bucket: string;
  region: string;
  cdnEndpoints: CDNEndpoint[];
}

export interface StreamManifest {
  id: string;
  videoId: string;
  protocol: StreamingProtocol;
  masterPlaylist: string;
  variantPlaylists: VariantPlaylist[];
  generatedAt: Date;
}

export interface VariantPlaylist {
  quality: QualityTier;
  playlist: string;
  bandwidth: number;
  resolution: { width: number; height: number };
}

export interface VideoAnalytics {
  videoId: string;
  views: number;
  uniqueViewers: number;
  averageWatchTime: number;
  totalWatchTime: number;
  completionRate: number;
  peakConcurrentViewers: number;
  geographicDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  timestamp: Date;
}

export interface PlaybackSession {
  id: string;
  videoId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  bufferCount: number;
  averageBitrate: number;
  quality: QualityTier;
}

export interface VideoProcessingJob {
  id: string;
  videoId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  transcodedVariants: string[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface VideoStreamingConfig {
  transcoding: {
    enabled: boolean;
    profiles: TranscodingProfile[];
    concurrentJobs: number;
  };
  storage: VideoStorage;
  adaptiveBitrate: AdaptiveBitrateConfig;
  analytics: {
    enabled: boolean;
    collectionInterval: number;
  };
}

export interface UploadedVideo {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: Date;
}

export interface VideoStreamResponse {
  manifest: StreamManifest;
  cdnUrl: string;
  analytics: VideoAnalytics;
}

export type ProcessingEventType =
  | 'job.queued'
  | 'job.started'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'transcode.variant_created'
  | 'analytics.collected';

export interface ProcessingEvent {
  type: ProcessingEventType;
  jobId: string;
  videoId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export type EventHandler = (event: ProcessingEvent) => void | Promise<void>;

export interface QualityMetadata {
  bitrate: number;
  fps: number;
  resolution: { width: number; height: number };
}

export const QUALITY_METADATA: Record<QualityTier, QualityMetadata> = {
  '360p': { bitrate: 800000, fps: 30, resolution: { width: 640, height: 360 } },
  '720p': { bitrate: 2500000, fps: 30, resolution: { width: 1280, height: 720 } },
  '1080p': { bitrate: 5000000, fps: 60, resolution: { width: 1920, height: 1080 } },
  '4k': { bitrate: 15000000, fps: 60, resolution: { width: 3840, height: 2160 } },
};

export const CODEC_COMPATIBILITY: Record<VideoCodec, string[]> = {
  h264: ['HLS', 'DASH'],
  h265: ['HLS', 'DASH'],
  vp9: ['HLS', 'DASH'],
  av1: ['HLS', 'DASH'],
};
