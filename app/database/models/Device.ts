import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export default class Device extends Model {
  static table = 'devices';

  @text('alias') alias!: string;
  @text('fingerprint') fingerprint!: string;
  @text('ip_address') ipAddress!: string;
  @field('port') port!: number;
  @text('device_type') deviceType!: string;
  @text('device_model') deviceModel?: string;
  @text('protocol') protocol!: string;
  @date('last_seen') lastSeen!: Date;
  @field('is_online') isOnline!: boolean;
}
