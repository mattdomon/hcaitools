import crypto from 'crypto';
import {
  VideoMetadata,
  TranscodingProfile,
  AdaptiveBitrateConfig,
  StreamManifest,
  VariantPlaylist,
  VideoAnalytics,
  PlaybackSession,
  VideoProcessingJob,
  VideoStreamingConfig,
  UploadedVideo,
  VideoStreamResponse,
  ProcessingEvent,
  EventHandler,
  VideoCodec,
  StreamingProtocol,
  QualityTier,
  QUALITY_METADATA,
  CODEC_COMPATIBILITY,
  CDNEndpoint,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class VideoStreamingService {
  private config: VideoStreamingConfig;
  private eventHandlers: Map<string, EventHandler[]>;
  private videos: Map<string, VideoMetadata>;
  private processingJobs: Map<string, VideoProcessingJob>;
  private playbackSessions: Map<string, PlaybackSession>;
  private analytics: Map<string, VideoAnalytics>;
  private uploadedVideos: Map<string, UploadedVideo>;
  private manifests: Map<string, StreamManifest>;

  constructor(config: VideoStreamingConfig) {
    this.config = config;
    this.eventHandlers = new Map();
    this.videos = new Map();
    this.processingJobs = new Map();
    this.playbackSessions = new Map();
    this.analytics = new Map();
    this.uploadedVideos = new Map();
    this.manifests = new Map();
  }

  private emitEvent(event: ProcessingEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(async (handler) => {
      try {
        await handler(event);
      } catch {
      }
    });
  }

  on(eventType: ProcessingEvent['type'], handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  off(eventType: ProcessingEvent['type'], handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(eventType, handlers);
    }
  }

  async uploadVideo(
    _fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string
  ): Promise<UploadedVideo> {
    const uploadId = generateId('upload');
    const uploadedVideo: UploadedVideo = {
      id: uploadId,
      originalFilename: filename,
      mimeType,
      size: 0,
      storagePath: `videos/${userId}/${uploadId}/${filename}`,
      uploadedAt: new Date(),
    };

    uploadedVideo.size = _fileBuffer.length;
    this.uploadedVideos.set(uploadId, uploadedVideo);
    return uploadedVideo;
  }

  async createVideoMetadata(
    uploadId: string,
    title: string,
    description: string,
    duration: number,
    codec: VideoCodec
  ): Promise<VideoMetadata> {
    const upload = this.uploadedVideos.get(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    const qualityMeta = QUALITY_METADATA['720p'];
    const videoId = generateId('video');
    const now = new Date();

    const metadata: VideoMetadata = {
      id: videoId,
      title,
      description,
      duration,
      width: qualityMeta.resolution.width,
      height: qualityMeta.resolution.height,
      fps: qualityMeta.fps,
      codec,
      bitrate: qualityMeta.bitrate,
      fileSize: upload.size,
      createdAt: now,
      updatedAt: now,
    };

    this.videos.set(videoId, metadata);
    return metadata;
  }

  async startTranscoding(videoId: string): Promise<VideoProcessingJob> {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const jobId = generateId('job');
    const job: VideoProcessingJob = {
      id: jobId,
      videoId,
      status: 'queued',
      progress: 0,
      currentStep: 'queued',
      transcodedVariants: [],
      startedAt: new Date(),
    };

    this.processingJobs.set(jobId, job);

    this.emitEvent({
      type: 'job.queued',
      jobId,
      videoId,
      timestamp: new Date(),
      data: { status: 'queued' },
    });

    this.processJob(job).catch(() => {});

    return job;
  }

  private async processJob(job: VideoProcessingJob): Promise<void> {
    job.status = 'processing';
    job.currentStep = 'initializing';
    this.emitEvent({
      type: 'job.started',
      jobId: job.id,
      videoId: job.videoId,
      timestamp: new Date(),
    });

    const profiles = this.config.transcoding.profiles;
    const totalSteps = profiles.length + 2;

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      job.currentStep = `transcoding_${profile.quality}`;
      job.progress = Math.round(((i + 1) / totalSteps) * 100);

      this.emitEvent({
        type: 'job.progress',
        jobId: job.id,
        videoId: job.videoId,
        timestamp: new Date(),
        data: { progress: job.progress, step: job.currentStep },
      });

      await this.simulateProcessing(100);

      const variantId = generateId('variant');
      job.transcodedVariants.push(variantId);

      this.emitEvent({
        type: 'transcode.variant_created',
        jobId: job.id,
        videoId: job.videoId,
        timestamp: new Date(),
        data: { variantId, profile: profile.name },
      });
    }

    job.currentStep = 'generating_manifest';
    job.progress = Math.round(((totalSteps - 1) / totalSteps) * 100);

    await this.simulateProcessing(50);

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();

    this.emitEvent({
      type: 'job.completed',
      jobId: job.id,
      videoId: job.videoId,
      timestamp: new Date(),
      data: { variants: job.transcodedVariants },
    });
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getTranscodingJob(jobId: string): Promise<VideoProcessingJob | undefined> {
    return this.processingJobs.get(jobId);
  }

  async getVideoMetadata(videoId: string): Promise<VideoMetadata | undefined> {
    return this.videos.get(videoId);
  }

  async createStreamManifest(
    videoId: string,
    protocol: StreamingProtocol
  ): Promise<StreamManifest> {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const codecCompatibility = CODEC_COMPATIBILITY[video.codec];
    if (!codecCompatibility.includes(protocol)) {
      throw new Error(`Codec ${video.codec} not compatible with protocol ${protocol}`);
    }

    const manifestId = generateId('manifest');
    const variantPlaylists: VariantPlaylist[] = this.config.transcoding.profiles.map(
      (profile) => ({
        quality: profile.quality,
        playlist: `${this.getStoragePath(videoId)}/${profile.quality}/playlist.m3u8`,
        bandwidth: profile.bitrate,
        resolution: profile.resolution,
      })
    );

    const manifest: StreamManifest = {
      id: manifestId,
      videoId,
      protocol,
      masterPlaylist: `${this.getStoragePath(videoId)}/master.m3u8`,
      variantPlaylists,
      generatedAt: new Date(),
    };

    this.manifests.set(manifestId, manifest);
    return manifest;
  }

  private getStoragePath(videoId: string): string {
    const endpoint = this.config.storage.cdnEndpoints[0];
    return `${endpoint.url}/videos/${videoId}`;
  }

  async getAdaptiveBitrateConfig(videoId: string): Promise<AdaptiveBitrateConfig> {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    return {
      ...this.config.adaptiveBitrate,
      profiles: this.config.transcoding.profiles,
    };
  }

  async getCDNEndpoints(): Promise<CDNEndpoint[]> {
    return this.config.storage.cdnEndpoints.filter((e) => e.healthy);
  }

  async addCDNEndpoint(url: string, region: string, priority: number): Promise<CDNEndpoint> {
    const endpoint: CDNEndpoint = {
      id: generateId('cdn'),
      url,
      region,
      priority,
      healthy: true,
    };
    this.config.storage.cdnEndpoints.push(endpoint);
    return endpoint;
  }

  async removeCDNEndpoint(endpointId: string): Promise<boolean> {
    const index = this.config.storage.cdnEndpoints.findIndex((e) => e.id === endpointId);
    if (index > -1) {
      this.config.storage.cdnEndpoints.splice(index, 1);
      return true;
    }
    return false;
  }

  async startPlaybackSession(
    videoId: string,
    userId: string,
    quality: QualityTier
  ): Promise<PlaybackSession> {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const sessionId = generateId('session');
    const session: PlaybackSession = {
      id: sessionId,
      videoId,
      userId,
      startedAt: new Date(),
      bufferCount: 0,
      averageBitrate: QUALITY_METADATA[quality].bitrate,
      quality,
    };

    this.playbackSessions.set(sessionId, session);
    await this.updateAnalytics(videoId);

    return session;
  }

  async endPlaybackSession(sessionId: string): Promise<void> {
    const session = this.playbackSessions.get(sessionId);
    if (session) {
      session.endedAt = new Date();
      this.playbackSessions.set(sessionId, session);
    }
  }

  async recordBufferingEvent(sessionId: string): Promise<void> {
    const session = this.playbackSessions.get(sessionId);
    if (session) {
      session.bufferCount++;
      this.playbackSessions.set(sessionId, session);
    }
  }

  private async updateAnalytics(videoId: string): Promise<void> {
    const sessions = Array.from(this.playbackSessions.values()).filter(
      (s) => s.videoId === videoId
    );

    const uniqueUsers = new Set(sessions.map((s) => s.userId));
    const totalWatchTime = sessions.reduce((sum, s) => {
      if (s.endedAt) {
        return sum + (s.endedAt.getTime() - s.startedAt.getTime()) / 1000;
      }
      return sum;
    }, 0);

    const video = this.videos.get(videoId);
    const completionRate = video ? totalWatchTime / (video.duration * uniqueUsers.size) : 0;

    const analytics: VideoAnalytics = {
      videoId,
      views: sessions.length,
      uniqueViewers: uniqueUsers.size,
      averageWatchTime: sessions.length > 0 ? totalWatchTime / sessions.length : 0,
      totalWatchTime,
      completionRate: Math.min(completionRate, 1),
      peakConcurrentViewers: sessions.filter((s) => !s.endedAt).length,
      geographicDistribution: {},
      deviceDistribution: {},
      timestamp: new Date(),
    };

    this.analytics.set(videoId, analytics);

    if (this.config.analytics.enabled) {
      this.emitEvent({
        type: 'analytics.collected',
        jobId: '',
        videoId,
        timestamp: new Date(),
        data: analytics as unknown as Record<string, unknown>,
      });
    }
  }

  async getVideoAnalytics(videoId: string): Promise<VideoAnalytics | undefined> {
    return this.analytics.get(videoId);
  }

  async getPlaybackSession(sessionId: string): Promise<PlaybackSession | undefined> {
    return this.playbackSessions.get(sessionId);
  }

  async getStreamManifest(manifestId: string): Promise<StreamManifest | undefined> {
    return this.manifests.get(manifestId);
  }

  async getVideoStreamResponse(
    videoId: string,
    protocol: StreamingProtocol
  ): Promise<VideoStreamResponse> {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const manifest = await this.createStreamManifest(videoId, protocol);
    const cdnEndpoints = await this.getCDNEndpoints();
    const cdnUrl = cdnEndpoints[0]?.url || '';
    const analytics = (await this.getVideoAnalytics(videoId)) || this.createEmptyAnalytics(videoId);

    return {
      manifest,
      cdnUrl,
      analytics,
    };
  }

  private createEmptyAnalytics(videoId: string): VideoAnalytics {
    return {
      videoId,
      views: 0,
      uniqueViewers: 0,
      averageWatchTime: 0,
      totalWatchTime: 0,
      completionRate: 0,
      peakConcurrentViewers: 0,
      geographicDistribution: {},
      deviceDistribution: {},
      timestamp: new Date(),
    };
  }

  async listVideos(): Promise<VideoMetadata[]> {
    return Array.from(this.videos.values());
  }

  async listProcessingJobs(): Promise<VideoProcessingJob[]> {
    return Array.from(this.processingJobs.values());
  }

  async getUploadedVideo(uploadId: string): Promise<UploadedVideo | undefined> {
    return this.uploadedVideos.get(uploadId);
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    return this.videos.delete(videoId);
  }

  async updateVideoMetadata(
    videoId: string,
    updates: Partial<Pick<VideoMetadata, 'title' | 'description'>>
  ): Promise<VideoMetadata | undefined> {
    const video = this.videos.get(videoId);
    if (!video) {
      return undefined;
    }

    const updated: VideoMetadata = {
      ...video,
      ...updates,
      updatedAt: new Date(),
    };

    this.videos.set(videoId, updated);
    return updated;
  }

  createTranscodingProfile(
    name: string,
    codec: VideoCodec,
    quality: QualityTier
  ): TranscodingProfile {
    const metadata = QUALITY_METADATA[quality];
    return {
      id: generateId('profile'),
      name,
      codec,
      quality,
      resolution: metadata.resolution,
      bitrate: metadata.bitrate,
      fps: metadata.fps,
    };
  }

  async retryFailedJob(jobId: string): Promise<VideoProcessingJob | undefined> {
    const job = this.processingJobs.get(jobId);
    if (!job || job.status !== 'failed') {
      return undefined;
    }

    job.status = 'queued';
    job.progress = 0;
    job.currentStep = 'queued';
    job.error = undefined;
    this.processingJobs.set(jobId, job);

    this.processJob(job).catch(() => {});

    return job;
  }

  getConfig(): VideoStreamingConfig {
    return this.config;
  }
}

export function createDefaultConfig(): VideoStreamingConfig {
  const service = new VideoStreamingService({
    transcoding: {
      enabled: true,
      profiles: [],
      concurrentJobs: 3,
    },
    storage: {
      id: generateId('storage'),
      provider: 'aws',
      bucket: 'manus-videos',
      region: 'us-east-1',
      cdnEndpoints: [
        {
          id: generateId('cdn'),
          url: 'https://cdn.manus.ai',
          region: 'us-east-1',
          priority: 1,
          healthy: true,
        },
      ],
    },
    adaptiveBitrate: {
      enabled: true,
      profiles: [],
      switchStrategy: 'bandwidth',
      minBitrate: 800000,
      maxBitrate: 15000000,
    },
    analytics: {
      enabled: true,
      collectionInterval: 5000,
    },
  });

  return service.getConfig();
}

export function createVideoStreamingService(
  config?: Partial<VideoStreamingConfig>
): VideoStreamingService {
  const defaultConfig = createDefaultConfig();
  const mergedConfig: VideoStreamingConfig = {
    ...defaultConfig,
    ...config,
    transcoding: {
      ...defaultConfig.transcoding,
      ...config?.transcoding,
      profiles: config?.transcoding?.profiles || defaultConfig.transcoding.profiles,
    },
    adaptiveBitrate: {
      ...defaultConfig.adaptiveBitrate,
      ...config?.adaptiveBitrate,
      profiles: config?.transcoding?.profiles || defaultConfig.transcoding.profiles,
    },
    analytics: {
      ...defaultConfig.analytics,
      ...config?.analytics,
    },
  };

  const profiles: TranscodingProfile[] = [
    { id: generateId('profile'), name: '360p', codec: 'h264', quality: '360p', resolution: { width: 640, height: 360 }, bitrate: 800000, fps: 30 },
    { id: generateId('profile'), name: '720p', codec: 'h264', quality: '720p', resolution: { width: 1280, height: 720 }, bitrate: 2500000, fps: 30 },
    { id: generateId('profile'), name: '1080p', codec: 'h264', quality: '1080p', resolution: { width: 1920, height: 1080 }, bitrate: 5000000, fps: 60 },
    { id: generateId('profile'), name: '4k', codec: 'h264', quality: '4k', resolution: { width: 3840, height: 2160 }, bitrate: 15000000, fps: 60 },
  ];

  mergedConfig.transcoding.profiles = profiles;
  mergedConfig.adaptiveBitrate.profiles = profiles;

  return new VideoStreamingService(mergedConfig);
}
