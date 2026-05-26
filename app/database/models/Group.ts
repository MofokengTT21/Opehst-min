import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class Group extends Model {
  static table = 'groups';

  @text('name') name!: string;
  @text('description') description!: string;
  @text('access_type') accessType!: string;
}
