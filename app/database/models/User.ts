import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('tenant_id') tenantId!: string;
  @field('role') role!: string;
  @field('name') name!: string;
  @field('phone') phone!: string;
  @field('email') email?: string;
  @field('department') department?: string;
  @field('avatar_url') avatarUrl?: string;
  @date('last_active') lastActive?: number;

  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
