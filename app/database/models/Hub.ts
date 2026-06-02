import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';

export default class Hub extends Model {
  static table = 'hubs';

  static associations = {
    channels: { type: 'has_many', foreignKey: 'hub_id' },
  } as const;

  @field('tenant_id') tenantId!: string;
  @field('name') name!: string;
  @field('description') description!: string | null;
  
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  @children('channels') channels!: any;
}
