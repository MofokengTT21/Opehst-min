import { Model } from '@nozbe/watermelondb';
import { field, date, text, relation } from '@nozbe/watermelondb/decorators';
import User from './User';
import Post from './Post';

export default class Comment extends Model {
  static table = 'comments';

  @field('tenant_id') tenantId!: string;
  @text('content') content!: string;

  @field('post_id') postId!: string;
  @relation('posts', 'post_id') post!: Post;

  @field('author_id') authorId!: string;
  @relation('users', 'author_id') author!: User;

  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
