import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Tenant extends Model {
  static table = 'tenants';

  @field('name') name!: string;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
