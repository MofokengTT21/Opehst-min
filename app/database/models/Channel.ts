import { Model } from '@nozbe/watermelondb';
import { field, date, text, json, relation } from '@nozbe/watermelondb/decorators';
import { ChannelEventType } from '@opehst/shared';
import Hub from './Hub';

export default class Channel extends Model {
  static table = 'channels';

  static associations = {
    posts: { type: 'has_many', foreignKey: 'channel_id' },
  } as const;

  @field('tenant_id') tenantId!: string;

  @field('hub_id') hubId!: string | null;
  @relation('hubs', 'hub_id') hub!: Hub | null;

  @text('name') name!: string;
  @text('description') description!: string | null;
  @field('category') category!: string | null;
  @field('access_type') accessType!: string | null;
  @json('event_types', (raw) => Array.isArray(raw) ? raw : []) eventTypes!: ChannelEventType[];

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
