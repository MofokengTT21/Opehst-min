import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 7, // Bumped for event_types support
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'role', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'department', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'last_active', type: 'number', isOptional: true },
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
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
