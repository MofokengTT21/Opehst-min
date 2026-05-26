import { Database } from '@nozbe/watermelondb';
import { Platform, NativeModules } from 'react-native';

import { schema } from './schema';
import Log from './models/Log';
import Attachment from './models/Attachment';
import Comment from './models/Comment';
import Item from './models/Item';
import Group from './models/Group';
import Subscription from './models/Subscription';
import Device from './models/Device';
import Transfer from './models/Transfer';

let adapter;

const hasNativeSQLite = !!(NativeModules && NativeModules.WMDatabaseBridge);

if ((Platform.OS === 'ios' || Platform.OS === 'android') && hasNativeSQLite) {
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  adapter = new SQLiteAdapter({
    schema,
    jsi: true, // Use JSI for faster SQLite execution
    onSetUpError: (error: any) => {
      console.error('Database setup failed', error);
    }
  });
} else {
  // Web / SSR Node context
  if (typeof window === 'undefined') {
    // Dummy adapter for SSR Node environment
    adapter = new (class DummyAdapter {
      schema = schema;
      async batch() {}
      async count() { return 0; }
      async destroyDeletedRecords() {}
      async find() { return null; }
      async getDeletedRecords() { return []; }
      async getLocal() { return null; }
      async query() { return []; }
      async removeLocal() {}
      async setLocal() {}
      async unsafeResetDatabase() {}
    })();
  } else {
    // Browser context
    const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
    adapter = new LokiJSAdapter({
      schema,
      useWebWorker: false,
      useIncrementalIndexedDB: true,
    });
  }
}

export const database = new Database({
  adapter,
  modelClasses: [
    Log,
    Attachment,
    Comment,
    Item,
    Group,
    Subscription,
    Device,
    Transfer,
  ],
});

