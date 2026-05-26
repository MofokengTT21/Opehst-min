import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Transfer extends Model {
  static table = 'transfers';

  static associations: Associations = {
    attachments: { type: 'belongs_to', key: 'attachment_id' },
  };

  @text('attachment_id') attachmentId!: string;
  @text('session_id') sessionId!: string;
  @text('direction') direction!: string;
  @text('status') status!: string;
  @field('progress') progress!: number;
  @text('error') error!: string;

  @readonly @date('created_at') createdAt!: Date;

  @relation('attachments', 'attachment_id') attachment: any;
}
