import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly, children } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Log extends Model {
  static table = 'logs';

  static associations: Associations = {
    attachments: { type: 'has_many', foreignKey: 'log_id' },
    comments: { type: 'has_many', foreignKey: 'log_id' },
  };

  @text('target_id') targetId!: string;
  @text('target_type') targetType!: string;
  @text('author_id') authorId!: string;
  @text('author_name') authorName!: string;
  @text('content') content!: string;
  @text('subject') subject?: string;
  @text('tag') tag?: string;
  @field('is_scada_alert') isScadaAlert!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('synced_at') syncedAt?: Date;

  @children('attachments') attachments: any;
  @children('comments') comments: any;
}
