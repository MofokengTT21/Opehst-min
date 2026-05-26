import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  try {
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create tables for Universal Item Protocol
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        scada_id TEXT,
        description TEXT NOT NULL,
        avatar_uri TEXT,
        access_type TEXT NOT NULL,
        status TEXT NOT NULL,
        vitals_summary TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        avatar_uri TEXT,
        access_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY NOT NULL,
        target_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        photo_uri TEXT,
        is_scada_alert INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY NOT NULL,
        post_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acknowledgements (
        id TEXT PRIMARY KEY NOT NULL,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    console.log('SQLite DB migration completed.');
  } catch (error) {
    console.error('Error during SQLite DB migration:', error);
  }
}
