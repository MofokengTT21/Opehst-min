import { Model } from '@nozbe/watermelondb';
import { text, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Comment extends Model {
  static table = 'comments';

  static associations: Associations = {
    logs: { type: 'belongs_to', key: 'log_id' },
  };

  @text('log_id') logId!: string;
  @text('author_name') authorName!: string;
  @text('content') content!: string;

  @readonly @date('created_at') createdAt!: Date;

  @relation('logs', 'log_id') log: any;
}
