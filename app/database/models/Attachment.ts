import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Attachment extends Model {
  static table = 'attachments';

  static associations: Associations = {
    logs: { type: 'belongs_to', key: 'log_id' },
    transfers: { type: 'has_many', foreignKey: 'attachment_id' },
  };

  @text('log_id') logId!: string;
  @text('file_name') fileName!: string;
  @text('file_type') fileType!: string;
  @field('file_size') fileSize!: number;
  @text('local_path') localPath!: string;
  @text('remote_url') remoteUrl!: string;
  @text('transfer_status') transferStatus!: string;

  @readonly @date('created_at') createdAt!: Date;

  @relation('logs', 'log_id') log: any;
}
