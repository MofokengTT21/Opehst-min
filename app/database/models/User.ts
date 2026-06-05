import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('tenant_id') tenantId!: string | null;
  @field('role') role!: string;
  @field('name') name!: string | null;
  @field('phone') phone!: string;
  @field('email') email!: string | null;
  // pending_org | pending_approval | active | rejected | pending_admin_auth
  @field('status') status!: string;
  @field('admin_auth_code') adminAuthCode!: string | null;
  @field('hub_id') hubId!: string | null;
  @field('avatar_url') avatarUrl!: string | null;
  @date('last_active') lastActive?: number;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
