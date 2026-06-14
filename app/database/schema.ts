import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 12, // Bumped for quoted comments and comment likes
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'tenant_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'role', type: 'string' },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'phone', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        // pending_org | pending_approval | active | rejected | pending_admin_auth
        { name: 'status', type: 'string' },
        { name: 'admin_auth_code', type: 'string', isOptional: true },
        { name: 'hub_id', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'last_active', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'tenants',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'channel_members',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'channel_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'role', type: 'string' }, // member | admin
        { name: 'joined_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'posts',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'channel_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'subject', type: 'string', isOptional: true },
        { name: 'content', type: 'string' },
        { name: 'event_type', type: 'string', isOptional: true },
        { name: 'media_urls', type: 'string', isOptional: true },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'channels',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'hub_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'access_type', type: 'string', isOptional: true },
        { name: 'event_types', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'quoted_comment_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'media_urls', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'reactions',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'post_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'comment_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'hubs',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
