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
    const raw = decodeURIComponent(req.params.title);
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    // 支援兩種輸入：flowId（如「回應祝賀及問安」）或 base64url(key)
    let doc = await findFlowDoc(collection, raw);
    if (!doc) {
      // 嘗試當 skill id：找 agents collection 對應 sub-agent 的 flow（保留向後相容）
      doc = await findFlowBySkillId(collection, raw);
    }
    res.json({ data: doc?.nodes ?? null });
  } catch (err: any) {
    console.error('GET flow error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

async function findFlowDoc(collection: any, keyOrTitle: string) {
  // 1. 直接用 base64url 當 _key
  const encoded = Buffer.from(keyOrTitle, 'utf8').toString('base64url');
  const doc = await collection.document(encoded).catch(() => null);
  if (doc) return doc;
  // 2. 嘗試當作 flow 文件其他 _key 形式（如 base64 + padding）
  try {
    const padded = keyOrTitle + '='.repeat((4 - keyOrTitle.length % 4) % 4);
    const decoded = Buffer.from(padded, 'base64url').toString('utf8');
    const k2 = Buffer.from(decoded, 'utf8').toString('base64url');
    return await collection.document(k2).catch(() => null);
  } catch {
    return null;
  }
}

async function findFlowBySkillId(collection: any, skillId: string) {
  // 業務員輸入 skill id（如 greeting-card）時，找對應 flow
  // 簡化：目前不做 skill→flow mapping，回 null
  return null;
}

router.put('/:title/flow', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.title);
    // 支援 query ?flowId=xxx 指定實際 flow id（避免 skill id 編碼後找不到對應文件）
    const flowId = (req.query.flowId as string) || raw;
    const body = req.body;
    if (!Array.isArray(body) || !body.every(isFlowNode)) {
      return res.status(400).json({ error: 'Body must be FlowNode[]' });
    }
    await ensureCollection(COLLECTION);
    const collection = getDb().collection(COLLECTION);
    const stored: StoredFlow = {
      _key: titleToKey(flowId),
      title: flowId,
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
