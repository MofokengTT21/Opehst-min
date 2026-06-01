import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

export default class EquipmentGroup extends Model {
  static table = 'equipment_groups';

  static associations = {
    posts: { type: 'has_many', foreignKey: 'equipment_group_id' },
  } as const;

  @field('tenant_id') tenantId!: string;
  @text('name') name!: string;
  @text('description') description!: string | null;
  @text('category') category!: string | null;
  @text('access_type') accessType!: string | null;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
