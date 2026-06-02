import { Model } from '@nozbe/watermelondb';
import { field, date, text, relation, json, children } from '@nozbe/watermelondb/decorators';
import User from './User';
import Channel from './Channel';

const sanitizeMediaUrls = (raw: any) => {
  return Array.isArray(raw) ? raw : [];
};

export default class Post extends Model {
  static table = 'posts';

  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
    reactions: { type: 'has_many', foreignKey: 'post_id' }
  } as const;

  @field('tenant_id') tenantId!: string;
  @text('content') content!: string;
  @json('media_urls', sanitizeMediaUrls) mediaUrls!: string[];
  @field('is_pinned') isPinned!: boolean;

  @field('author_id') authorId!: string;
  @relation('users', 'author_id') author!: User;

  @field('channel_id') channelId!: string | null;
  @relation('channels', 'channel_id') channel!: Channel | null;

  @field('subject') subject!: string | null;
  @field('event_type') eventType!: string | null;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  @children('comments') comments!: any;
  @children('reactions') reactions!: any;
}
