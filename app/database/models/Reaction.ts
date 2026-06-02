import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';
import { ReactionType } from '@opehst/shared';

export default class Reaction extends Model {
  static table = 'reactions';

  @field('tenant_id') tenantId!: string;
  @field('post_id') postId!: string;
  @field('user_id') userId!: string;
  @field('type') type!: ReactionType;
  
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
