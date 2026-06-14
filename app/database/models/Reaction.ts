import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';
import { ReactionType } from '@opehst/shared';

export default class Reaction extends Model {
  static table = 'reactions';

  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' },
  } as const;

  @field('tenant_id') tenantId!: string;
  @field('post_id') postId?: string;
  @field('comment_id') commentId?: string;
  @field('user_id') userId!: string;
  @field('type') type!: ReactionType;
  
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
