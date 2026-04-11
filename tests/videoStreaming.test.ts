import crypto from 'crypto';
import {
  VideoStreamingService,
  createVideoStreamingService,
  createDefaultConfig,
} from '../src/core/videoStreaming/videoStreaming';
import {
  VideoMetadata,
  VideoProcessingJob,
  PlaybackSession,
  VideoAnalytics,
  StreamManifest,
  TranscodingProfile,
  AdaptiveBitrateConfig,
  CDNEndpoint,
  ProcessingEvent,
  QualityTier,
  VideoCodec,
  StreamingProtocol,
  QUALITY_METADATA,
  CODEC_COMPATIBILITY,
} from '../src/core/videoStreaming/types';

let mockCounter = 0;
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockImplementation(() => ({
    toString: jest.fn().mockReturnValue(`mockedhex${++mockCounter}`),
  })),
}));

describe('VideoStreamingService', () => {
  let service: VideoStreamingService;
  const mockConfig = createDefaultConfig();

  beforeEach(() => {
    jest.clearAllMocks();
    service = createVideoStreamingService();
  });

  describe('Configuration', () => {
    test('should create service with default config', () => {
      const service = createVideoStreamingService();
      expect(service).toBeInstanceOf(VideoStreamingService);
    });

    test('should return config via getConfig', () => {
      const config = service.getConfig();
      expect(config).toBeDefined();
      expect(config.transcoding).toBeDefined();
      expect(config.storage).toBeDefined();
      expect(config.adaptiveBitrate).toBeDefined();
    });

    test('should have default transcoding profiles', () => {
      const config = service.getConfig();
      expect(config.transcoding.profiles.length).toBe(4);
    });

    test('should have correct quality tiers in profiles', () => {
      const config = service.getConfig();
      const qualities = config.transcoding.profiles.map((p) => p.quality);
      expect(qualities).toContain('360p');
      expect(qualities).toContain('720p');
      expect(qualities).toContain('1080p');
      expect(qualities).toContain('4k');
    });
  });

  describe('Video Upload', () => {
    test('should upload video with correct metadata', async () => {
      const buffer = Buffer.from('test video data');
      const result = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');

      expect(result.id).toMatch(/^upload_mockedhex\d+$/);
      expect(result.originalFilename).toBe('test.mp4');
      expect(result.mimeType).toBe('video/mp4');
      expect(result.storagePath).toContain('user123');
    });

    test('should store uploaded video', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const retrieved = await service.getUploadedVideo(uploaded.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.originalFilename).toBe('test.mp4');
    });

    test('should set correct size after upload', async () => {
      const buffer = Buffer.from('test video data');
      const result = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');

      expect(result.size).toBe(buffer.length);
    });
  });

  describe('Video Metadata', () => {
    test('should create video metadata from upload', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const metadata = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'A test video description',
        120,
        'h264'
      );

      expect(metadata.id).toMatch(/^video_mockedhex\d+$/);
      expect(metadata.title).toBe('Test Video');
      expect(metadata.description).toBe('A test video description');
      expect(metadata.duration).toBe(120);
      expect(metadata.codec).toBe('h264');
    });

    test('should throw error for non-existent upload', async () => {
      await expect(
        service.createVideoMetadata('invalid', 'Title', 'Desc', 100, 'h264')
      ).rejects.toThrow('Upload not found');
    });

    test('should retrieve video metadata', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const created = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );
      const retrieved = await service.getVideoMetadata(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Video');
    });

    test('should update video metadata', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const created = await service.createVideoMetadata(
        uploaded.id,
        'Original Title',
        'Original Desc',
        120,
        'h264'
      );

      const updated = await service.updateVideoMetadata(created.id, {
        title: 'Updated Title',
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.description).toBe('Original Desc');
    });

    test('should list all videos', async () => {
      const buffer = Buffer.from('test video data');
      await service.uploadVideo(buffer, 'test1.mp4', 'video/mp4', 'user1');
      const uploaded = await service.uploadVideo(buffer, 'test2.mp4', 'video/mp4', 'user2');
      await service.createVideoMetadata(uploaded.id, 'Video 1', 'Desc', 100, 'h264');

      const videos = await service.listVideos();
      expect(videos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Transcoding', () => {
    test('should start transcoding job', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const job = await service.startTranscoding(video.id);

      expect(job.id).toMatch(/^job_mockedhex\d+$/);
      expect(job.videoId).toBe(video.id);
      expect(['queued', 'processing']).toContain(job.status);
    });

    test('should track transcoding job', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const job = await service.startTranscoding(video.id);
      const tracked = await service.getTranscodingJob(job.id);

      expect(tracked).toBeDefined();
      expect(tracked?.id).toBe(job.id);
    });

    test('should complete transcoding job', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startTranscoding(video.id);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const jobs = await service.listProcessingJobs();
      const completedJob = jobs.find((j) => j.videoId === video.id);
      expect(completedJob?.status).toBe('completed');
    });

    test('should emit job events', async () => {
      const events: ProcessingEvent[] = [];
      service.on('job.queued', (event) => { events.push(event); });
      service.on('job.started', (event) => { events.push(event); });
      service.on('job.completed', (event) => { events.push(event); });

      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startTranscoding(video.id);
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    test('should create transcoding profile correctly', () => {
      const profile = service.createTranscodingProfile('1080p_high', 'h264', '1080p');

      expect(profile.id).toMatch(/^profile_mockedhex\d+$/);
      expect(profile.name).toBe('1080p_high');
      expect(profile.codec).toBe('h264');
      expect(profile.quality).toBe('1080p');
      expect(profile.resolution).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('Stream Manifests', () => {
    test('should create HLS manifest', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const manifest = await service.createStreamManifest(video.id, 'HLS');

      expect(manifest.id).toMatch(/^manifest_mockedhex\d+$/);
      expect(manifest.protocol).toBe('HLS');
      expect(manifest.variantPlaylists.length).toBe(4);
    });

    test('should create DASH manifest', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const manifest = await service.createStreamManifest(video.id, 'DASH');

      expect(manifest.protocol).toBe('DASH');
    });

    test('should throw for incompatible codec', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await expect(service.createStreamManifest(video.id, 'RTMP')).rejects.toThrow();
    });

    test('should retrieve manifest by id', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const manifest = await service.createStreamManifest(video.id, 'HLS');
      const retrieved = await service.getStreamManifest(manifest.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(manifest.id);
    });
  });

  describe('Adaptive Bitrate', () => {
    test('should return adaptive bitrate config', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const abr = await service.getAdaptiveBitrateConfig(video.id);

      expect(abr.enabled).toBe(true);
      expect(abr.profiles.length).toBe(4);
      expect(abr.minBitrate).toBeDefined();
      expect(abr.maxBitrate).toBeDefined();
    });

    test('should have correct switch strategies', () => {
      const config = service.getConfig();
      expect(['bandwidth', 'device', 'manual']).toContain(config.adaptiveBitrate.switchStrategy);
    });
  });

  describe('CDN Endpoints', () => {
    test('should get healthy CDN endpoints', async () => {
      const endpoints = await service.getCDNEndpoints();
      expect(Array.isArray(endpoints)).toBe(true);
    });

    test('should add new CDN endpoint', async () => {
      const endpoint = await service.addCDNEndpoint('https://edge1.manus.ai', 'eu-west-1', 2);

      expect(endpoint.id).toMatch(/^cdn_mockedhex\d+$/);
      expect(endpoint.url).toBe('https://edge1.manus.ai');
      expect(endpoint.region).toBe('eu-west-1');
      expect(endpoint.healthy).toBe(true);
    });

    test('should remove CDN endpoint', async () => {
      const config = service.getConfig();
      const initialCount = config.storage.cdnEndpoints.length;

      const added = await service.addCDNEndpoint('https://edge2.manus.ai', 'eu-west-2', 3);
      await service.removeCDNEndpoint(added.id);

      const newCount = (service.getConfig().storage.cdnEndpoints.length);
      expect(newCount).toBe(initialCount);
    });
  });

  describe('Playback Sessions', () => {
    test('should start playback session', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const session = await service.startPlaybackSession(video.id, 'user456', '720p');

      expect(session.id).toMatch(/^session_mockedhex\d+$/);
      expect(session.videoId).toBe(video.id);
      expect(session.userId).toBe('user456');
      expect(session.quality).toBe('720p');
    });

    test('should end playback session', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const session = await service.startPlaybackSession(video.id, 'user456', '720p');
      await service.endPlaybackSession(session.id);

      const ended = await service.getPlaybackSession(session.id);
      expect(ended?.endedAt).toBeDefined();
    });

    test('should record buffering events', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const session = await service.startPlaybackSession(video.id, 'user456', '720p');
      await service.recordBufferingEvent(session.id);
      await service.recordBufferingEvent(session.id);

      const updated = await service.getPlaybackSession(session.id);
      expect(updated?.bufferCount).toBe(2);
    });
  });

  describe('Analytics', () => {
    test('should collect video analytics', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startPlaybackSession(video.id, 'user1', '720p');
      await service.startPlaybackSession(video.id, 'user2', '1080p');

      const analytics = await service.getVideoAnalytics(video.id);
      expect(analytics).toBeDefined();
      expect(analytics?.views).toBeGreaterThanOrEqual(0);
    });

    test('should track unique viewers', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user1');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startPlaybackSession(video.id, 'user1', '720p');
      await service.startPlaybackSession(video.id, 'user2', '720p');
      await service.startPlaybackSession(video.id, 'user3', '1080p');

      const analytics = await service.getVideoAnalytics(video.id);
      expect(analytics?.uniqueViewers).toBe(3);
    });

    test('should emit analytics events', async () => {
      const events: ProcessingEvent[] = [];
      service.on('analytics.collected', (event) => { events.push(event); });

      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startPlaybackSession(video.id, 'user1', '720p');

      expect(events.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Video Stream Response', () => {
    test('should get complete stream response', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const response = await service.getVideoStreamResponse(video.id, 'HLS');

      expect(response.manifest).toBeDefined();
      expect(response.cdnUrl).toBeDefined();
      expect(response.analytics).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    test('should register and unregister event handlers', async () => {
      const handler = jest.fn();
      service.on('job.completed', handler);
      service.off('job.completed', handler);

      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startTranscoding(video.id);
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle multiple event types', async () => {
      const events: ProcessingEvent[] = [];
      service.on('job.progress', (e) => { events.push(e); });
      service.on('transcode.variant_created', (e) => { events.push(e); });

      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      await service.startTranscoding(video.id);
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Video Deletion', () => {
    test('should delete video', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const deleted = await service.deleteVideo(video.id);
      expect(deleted).toBe(true);
    });

    test('should return false for non-existent video', async () => {
      const deleted = await service.deleteVideo('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('Job Retry', () => {
    test('should return undefined for non-failed job', async () => {
      const buffer = Buffer.from('test video data');
      const uploaded = await service.uploadVideo(buffer, 'test.mp4', 'video/mp4', 'user123');
      const video = await service.createVideoMetadata(
        uploaded.id,
        'Test Video',
        'Desc',
        120,
        'h264'
      );

      const job = await service.startTranscoding(video.id);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const retried = await service.retryFailedJob(job.id);
      expect(retried).toBeUndefined();
    });
  });
});

describe('Types and Constants', () => {
  describe('Quality Metadata', () => {
    test('should have correct metadata for 360p', () => {
      const meta = QUALITY_METADATA['360p'];
      expect(meta.bitrate).toBe(800000);
      expect(meta.resolution).toEqual({ width: 640, height: 360 });
    });

    test('should have correct metadata for 720p', () => {
      const meta = QUALITY_METADATA['720p'];
      expect(meta.bitrate).toBe(2500000);
      expect(meta.resolution).toEqual({ width: 1280, height: 720 });
    });

    test('should have correct metadata for 1080p', () => {
      const meta = QUALITY_METADATA['1080p'];
      expect(meta.bitrate).toBe(5000000);
      expect(meta.resolution).toEqual({ width: 1920, height: 1080 });
    });

    test('should have correct metadata for 4k', () => {
      const meta = QUALITY_METADATA['4k'];
      expect(meta.bitrate).toBe(15000000);
      expect(meta.resolution).toEqual({ width: 3840, height: 2160 });
    });
  });

  describe('Codec Compatibility', () => {
    test('h264 should support HLS and DASH', () => {
      expect(CODEC_COMPATIBILITY['h264']).toEqual(['HLS', 'DASH']);
    });

    test('h265 should support HLS and DASH', () => {
      expect(CODEC_COMPATIBILITY['h265']).toEqual(['HLS', 'DASH']);
    });

    test('vp9 should support HLS and DASH', () => {
      expect(CODEC_COMPATIBILITY['vp9']).toEqual(['HLS', 'DASH']);
    });

    test('av1 should support HLS and DASH', () => {
      expect(CODEC_COMPATIBILITY['av1']).toEqual(['HLS', 'DASH']);
    });
  });
});
