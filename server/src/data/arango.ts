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

/**
 * Ensure an edge collection exists.
 */
export async function ensureEdgeCollection(name: string): Promise<void> {
  const db = getDb();
  const collections = await db.listCollections();
  const exists = collections.some((c) => c.name === name);
  if (!exists) {
    await db.createCollection(name, { type: 3 /* arangojs EDGE collection type */ });
  }
}

export async function ensureGraph(opts: {
  name: string;
  edgeCollections: string[];
  vertexCollections: string[];
}): Promise<void> {
  const db = getDb();
  const graphs = await db.listGraphs();
  const exists = graphs.some((g) => g.name === opts.name);
  if (exists) return;

  const edgeDefs = opts.edgeCollections.map((ec) => ({
    collection: ec,
    from: opts.vertexCollections,
    to: opts.vertexCollections,
  }));
  await db.createGraph(opts.name, edgeDefs);
}

export async function ensureHashIndex(
  collection: string,
  fields: string[],
  unique = false
): Promise<void> {
  const db = getDb();
  const col = db.collection(collection);
  const indexes = await col.indexes();
  const fieldKey = fields.join(',');
  const exists = (indexes as Array<{ type?: string; fields?: string[] }>).some(
    (i) => i.type === 'hash' && Array.isArray(i.fields) && i.fields.join(',') === fieldKey
  );
  if (!exists) {
    await (col as any).ensureIndex({
      type: 'hash',
      fields,
      unique,
    });
  }
}
