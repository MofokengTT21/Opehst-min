import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'logs',
      columns: [
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'author_id', type: 'string' },
        { name: 'author_name', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'subject', type: 'string', isOptional: true },
        { name: 'tag', type: 'string', isOptional: true },
        { name: 'is_scada_alert', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'attachments',
      columns: [
        { name: 'log_id', type: 'string', isIndexed: true },
        { name: 'file_name', type: 'string' },
        { name: 'file_type', type: 'string' },
        { name: 'file_size', type: 'number' },
        { name: 'local_path', type: 'string', isOptional: true },
        { name: 'remote_url', type: 'string', isOptional: true },
        { name: 'transfer_status', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'log_id', type: 'string', isIndexed: true },
        { name: 'author_name', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'access_type', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'access_type', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'subscriptions',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'devices',
      columns: [
        { name: 'alias', type: 'string' },
        { name: 'fingerprint', type: 'string', isIndexed: true },
        { name: 'ip_address', type: 'string' },
        { name: 'port', type: 'number' },
        { name: 'device_type', type: 'string' },
        { name: 'device_model', type: 'string', isOptional: true },
        { name: 'protocol', type: 'string' },
        { name: 'last_seen', type: 'number' },
        { name: 'is_online', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'transfers',
      columns: [
        { name: 'attachment_id', type: 'string', isIndexed: true },
        { name: 'session_id', type: 'string' },
        { name: 'direction', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'progress', type: 'number' },
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
