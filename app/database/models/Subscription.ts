import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class Subscription extends Model {
  static table = 'subscriptions';

  @text('user_id') userId!: string;
  @text('target_id') targetId!: string;
  @text('target_type') targetType!: string;
  @text('status') status!: string;
}
