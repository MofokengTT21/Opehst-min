import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import Channel from './Channel';
import User from './User';

export default class ChannelMember extends Model {
  static table = 'channel_members';

  static associations = {
    channels: { type: 'belongs_to', key: 'channel_id' },
    users: { type: 'belongs_to', key: 'user_id' },
  } as const;

  @field('tenant_id') tenantId!: string;
  @field('channel_id') channelId!: string;
  @field('user_id') userId!: string;
  @field('role') role!: string; // 'member' | 'admin'

  @relation('channels', 'channel_id') channel!: Channel;
  @relation('users', 'user_id') user!: User;

  @date('joined_at') joinedAt!: number;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
