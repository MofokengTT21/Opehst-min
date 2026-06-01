import { Model } from '@nozbe/watermelondb';
import { field, date, text, relation, json } from '@nozbe/watermelondb/decorators';
import User from './User';
import EquipmentGroup from './EquipmentGroup';

const sanitizeMediaUrls = (raw: any) => {
  return Array.isArray(raw) ? raw : [];
};

export default class Post extends Model {
  static table = 'posts';

  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
    reactions: { type: 'has_many', foreignKey: 'post_id' }
  } as const;

  @field('tenant_id') tenantId!: string;
  @text('content') content!: string;
  @json('media_urls', sanitizeMediaUrls) mediaUrls!: string[];
  @field('is_pinned') isPinned!: boolean;

  @field('author_id') authorId!: string;
  @relation('users', 'author_id') author!: User;

  @field('equipment_group_id') equipmentGroupId!: string | null;
  @relation('equipment_groups', 'equipment_group_id') equipmentGroup!: EquipmentGroup | null;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
