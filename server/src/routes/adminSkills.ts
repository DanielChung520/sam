import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ensureCollection, getDb } from '../data/arango.js';

const router = Router();
const COLLECTION = 'skill_flows';

interface FlowNode {
  id: string;
  label: string;
  desc?: string;
  color?: string;
  enabled: boolean;
  pos?: { x: number; y: number };
}

interface FlowEdge {
  source: string;
  target: string;
  label?: string;
}

interface StoredFlow {
  _key: string;
  title: string;
  nodes: FlowNode[];
  edges?: FlowEdge[];
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
    typeof n.enabled === 'boolean' &&
    (n.desc === undefined || typeof n.desc === 'string') &&
    (n.color === undefined || typeof n.color === 'string')
  );
}

router.use(authMiddleware);

function titleToKey(title: string): string {
  return Buffer.from(title, 'utf8').toString('base64url');
}

router.get('/:title/flow', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.title);
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    const flowId = (req.query.flowId as string) || raw;
    const key = titleToKey(flowId);
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
    const raw = decodeURIComponent(req.params.title);
    const flowId = (req.query.flowId as string) || raw;
    const body = req.body;
    if (!Array.isArray(body) || !body.every(isFlowNode)) {
      return res.status(400).json({ error: 'Body must be FlowNode[]' });
    }
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    const key = titleToKey(flowId);
    // 保留既有 edges（PUT body 只含 nodes，避免 FlowEditor 存檔時把 edges 清掉）
    const existing = (await collection.document(key).catch(() => null)) as StoredFlow | null;
    const stored: StoredFlow = {
      _key: key,
      title: flowId,
      nodes: body,
      edges: existing?.edges ?? [],
      updatedAt: new Date().toISOString(),
    };
    const result = await collection.save(stored, { overwriteMode: 'replace' });
    res.json({ data: body, meta: { _id: result._id, _rev: result._rev, edges: stored.edges?.length ?? 0 } });
  } catch (err: any) {
    console.error('PUT flow error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
