import { Database } from 'arangojs';

const ARANGO_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const ARANGO_DB = process.env.ARANGO_DB || 'sam';
const ARANGO_ROOT_PASSWORD = process.env.ARANGO_ROOT_PASSWORD || '';

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = new Database({
      url: ARANGO_URL,
      databaseName: ARANGO_DB,
      auth: ARANGO_ROOT_PASSWORD ? { username: 'root', password: ARANGO_ROOT_PASSWORD } : undefined,
    });
  }
  return dbInstance;
}

export async function ensureCollection(name: string): Promise<void> {
  const db = getDb();
  const collections = await db.listCollections();
  const exists = collections.some((c) => c.name === name);
  if (!exists) {
    await db.createCollection(name);
  }
}
