import { Database } from '@nozbe/watermelondb';
import { Platform, NativeModules } from 'react-native';

import { schema } from './schema';
import User from './models/User';
import Post from './models/Post';
import Channel from './models/Channel';
import Hub from './models/Hub';
import Comment from './models/Comment';
import Reaction from './models/Reaction';

let adapter: any;

const hasNativeSQLite = !!(NativeModules && NativeModules.WMDatabaseBridge);

if ((Platform.OS === 'ios' || Platform.OS === 'android') && hasNativeSQLite) {
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  adapter = new SQLiteAdapter({
    schema,
    jsi: true,
    onSetUpError: (error: any) => {
      console.error('Database setup failed', error);
    }
  });
} else {
  if (typeof window === 'undefined') {
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
    User,
    Hub,
    Post,
    Channel,
    Comment,
    Reaction
  ],
});
