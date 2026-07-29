import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ensureCollection, getDb } from '../data/arango.js';

const router = Router();
const COLLECTION = 'skill_flows';

interface FlowNode {
  id: string;
  label: string;
  desc: string;
  color: string;
  enabled: boolean;
  pos?: { x: number; y: number };
}

interface StoredFlow {
  _key: string;
  title: string;
  nodes: FlowNode[];
  updatedAt: string;
}

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'dev-secret',
    ) as { sub: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isFlowNode(v: unknown): v is FlowNode {
  if (!v || typeof v !== 'object') return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.label === 'string' &&
    typeof n.desc === 'string' &&
    typeof n.color === 'string' &&
    typeof n.enabled === 'boolean'
  );
}

router.use(authMiddleware);

function titleToKey(title: string): string {
  return Buffer.from(title, 'utf8').toString('base64url');
}

router.get('/:title/flow', async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title);
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    const key = titleToKey(title);
    const doc = (await collection.document(key).catch(() => null)) as StoredFlow | null;
    if (!doc) {
      return res.json({ data: null });
    }
    res.json({ data: doc.nodes });
  } catch (err: any) {
    console.error('GET flow error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

router.put('/:title/flow', async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title);
    const body = req.body;
    if (!Array.isArray(body) || !body.every(isFlowNode)) {
      return res.status(400).json({ error: 'Body must be FlowNode[]' });
    }
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    const stored: StoredFlow = {
      _key: titleToKey(title),
      title,
      nodes: body,
      updatedAt: new Date().toISOString(),
    };
    const result = await collection.save(stored, { overwriteMode: 'replace' });
    res.json({ data: body, meta: { _id: result._id, _rev: result._rev } });
  } catch (err: any) {
    console.error('PUT flow error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
