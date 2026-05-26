import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class Item extends Model {
  static table = 'items';

  @text('name') name!: string;
  @text('category') category!: string;
  @text('description') description!: string;
  @text('status') status!: string;
  @text('access_type') accessType!: string;
}
