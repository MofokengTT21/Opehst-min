import { Model } from '@nozbe/watermelondb';
import { field, date, json } from '@nozbe/watermelondb/decorators';

const sanitizeMediaUrls = (rawUrls: any) => {
  return Array.isArray(rawUrls) ? rawUrls : [];
};

export default class Comment extends Model {
  static table = 'comments';

  @field('tenant_id') tenantId!: string;
  @field('post_id') postId!: string;
  @field('author_id') authorId!: string;
  @field('content') content!: string;
  @field('quoted_comment_id') quotedCommentId?: string;
  @json('media_urls', sanitizeMediaUrls) mediaUrls!: string[];
  
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
