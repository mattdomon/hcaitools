/**
 * Social Media Integration
 * Complete social media API abstraction with multi-platform support
 */

export {
  SocialPlatform,
  PostType,
  PostStatus,
  MediaType,
  CommentStatus,
  MessageStatus,
  EngagementType,
  MediaAttachment,
  SocialPost,
  ScheduledPost,
  PostAnalytics,
  Comment,
  DirectMessage,
  Conversation,
  SocialAccount,
  SocialAnalytics,
  EngagementStats,
  Hashtag,
  Mention,
  CrossPlatformPost,
  SocialMediaService,
  GetPostsOptions,
  GetCommentsOptions,
  PlatformClient,
} from './types';

export { SocialMediaServiceImpl, createSocialMediaService } from './socialMedia';

import { SocialMediaServiceImpl } from './socialMedia';
import { SocialPlatform, PostType, CommentStatus, MediaAttachment, SocialPost } from './types';

export class SocialMediaManus {
  private service: SocialMediaServiceImpl;

  constructor() {
    this.service = new SocialMediaServiceImpl();
  }

  async connectSocialAccount(
    userId: string,
    platform: SocialPlatform,
    accessToken: string
  ) {
    return this.service.connectAccount(userId, platform, accessToken);
  }

  async disconnectSocialAccount(accountId: string) {
    return this.service.disconnectAccount(accountId);
  }

  async getSocialAccounts(userId: string) {
    return this.service.getConnectedAccounts(userId);
  }

  async createSocialPost(
    accountId: string,
    content: string,
    postType: PostType,
    options?: {
      media?: MediaAttachment[];
      link?: SocialPost['link'];
      tags?: string[];
      mentions?: string[];
      location?: SocialPost['location'];
    }
  ) {
    return this.service.createPost(accountId, {
      platform: 'twitter',
      userId: 'user',
      content,
      postType,
      media: options?.media,
      link: options?.link,
      tags: options?.tags,
      mentions: options?.mentions,
      location: options?.location,
      status: 'draft',
    });
  }

  async scheduleSocialPost(
    accountId: string,
    content: string,
    postType: PostType,
    scheduledFor: Date
  ) {
    return this.service.schedulePost(accountId, {
      platform: 'twitter',
      userId: 'user',
      content,
      postType,
      status: 'scheduled',
      scheduledFor,
    });
  }

  async publishScheduledPost(postId: string) {
    return this.service.publishPost(postId);
  }

  async publishToAllPlatforms(
    userId: string,
    content: string,
    platforms: SocialPlatform[]
  ) {
    const crossPost = await this.service.createCrossPlatformPost({
      userId,
      content,
      postType: 'text',
      platforms,
      status: 'draft',
      individualPostIds: [],
    });
    return this.service.publishCrossPlatformPost(crossPost.crossPostId);
  }

  async getPostAnalytics(postId: string) {
    return this.service.getPostAnalytics(postId);
  }

  async getEngagementStats(
    userId: string,
    platform: SocialPlatform,
    days: number = 30
  ) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return this.service.getEngagementStats(userId, platform, { start, end });
  }

  async getTrendingHashtags(platform: SocialPlatform, limit?: number) {
    return this.service.getTrendingHashtags(platform, limit);
  }

  async addComment(postId: string, content: string) {
    return this.service.createComment(postId, content);
  }

  async replyToComment(commentId: string, content: string) {
    return this.service.replyToComment(commentId, content);
  }

  async moderateComment(commentId: string, status: CommentStatus) {
    return this.service.moderateComment(commentId, status);
  }

  async sendDirectMessage(
    accountId: string,
    conversationId: string,
    content: string
  ) {
    return this.service.sendMessage(accountId, conversationId, content);
  }

  async getMessages(accountId: string, conversationId: string) {
    return this.service.getConversationMessages(accountId, conversationId);
  }

  async markMessageAsRead(messageId: string) {
    return this.service.markMessageAsRead(messageId);
  }

  async getMentions(accountId: string) {
    return this.service.getMentions(accountId);
  }

  async getComments(postId: string) {
    return this.service.getComments(postId);
  }
}
