// Context Retriever — 從 L2 memory + L3 business KB 撈相關 context
//
// 流程（學 aibox-th hybrid_rag + Zep freshness）：
//   1. Embed 訊息（bge-m3 或 fallback）
//   2. Qdrant 撈 L2 entities → top 20（filter by customerId + not forgotten）
//   3. ArangoDB graph traversal → 1-hop 鄰居
//   4. Qdrant 撈 L3 KB → top 5（filter by channelId + enabled）
//   5. LLM re-rank（gpt-4o-mini）→ 最終 top K
//   6. Format with freshness labels

import { getEmbedder, type Vector } from '../lib/embedder.js';
import { getQdrant, QDRANT_COLLECTIONS, ensureQdrantCollection, ensurePayloadIndexes } from '../lib/qdrant.js';
import {
  findEntitiesByKeys,
  getRelatedEntities,
  type MemoryEntity,
} from '../data/memoryRepo.js';
import { listByChannel, type BusinessDoc } from '../data/businessDocRepo.js';
import { chatCompletion, type ChatMessage } from './llmClient.js';

export interface RetrievedMemory {
  key: string;
  name: string;
  category: string;
  content: string;
  freshness: string;
  confidence: number;
  source: 'vector' | 'graph';
}

export interface RetrievedKB {
  key: string;
  title: string;
  type: string;
  content: string;
  score: number;
}

export interface RetrievedContext {
  memories: RetrievedMemory[];
  businessDocs: RetrievedKB[];
  retrievalCacheAt: number;
}

function hashKeyToQdrantId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function calculateFreshness(updatedAt: number): string {
  const days = Math.floor((Date.now() - updatedAt) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export interface RetrieveOptions {
  topEntities?: number;
  topKB?: number;
  reRankTopK?: number;
  includeGraphNeighbors?: boolean;
  maxMemories?: number;
  maxKB?: number;
}

const DEFAULTS: Required<RetrieveOptions> = {
  topEntities: 20,
  topKB: 5,
  reRankTopK: 5,
  includeGraphNeighbors: true,
  maxMemories: 5,
  maxKB: 3,
};

export async function retrieveContext(
  customerId: string,
  channelId: string,
  userMessage: string,
  options: RetrieveOptions = {}
): Promise<RetrievedContext> {
  const opts = { ...DEFAULTS, ...options };
  const embedder = getEmbedder();
  const qdrant = getQdrant();

  await ensureQdrantCollection(QDRANT_COLLECTIONS.MEMORIES, embedder.vectorSize);
  await ensureQdrantCollection(QDRANT_COLLECTIONS.BUSINESS, embedder.vectorSize);
  await ensurePayloadIndexes();

  const queryEmbedding = await embedder.embed(userMessage);

  const memoryHits = await qdrant.search(QDRANT_COLLECTIONS.MEMORIES, {
    vector: queryEmbedding,
    filter: {
      must: [
        { key: 'customerId', match: { value: customerId } },
        { key: 'forgotten', match: { value: false } },
      ],
    },
    limit: opts.topEntities,
    with_payload: true,
  });

  const candidateKeys = memoryHits.map((h) => {
    const payload = h.payload as { entityKey?: string };
    return payload.entityKey;
  }).filter((k): k is string => typeof k === 'string');

  const entities = await findEntitiesByKeys(candidateKeys);
  const entityMap = new Map<string, MemoryEntity>();
  for (const e of entities) entityMap.set(e._key, e);

  // 圖譜擴展：把命中的 entity 的 1-hop 鄰居也納入候選（設計文件 §3 步驟 3）
  const graphEntities = opts.includeGraphNeighbors && candidateKeys.length > 0
    ? await getRelatedEntities(candidateKeys, 1).catch(() => [])
    : [];
  for (const g of graphEntities) {
    if (g.from?._key) entityMap.set(g.from._key, g.from);
    if (g.to?._key) entityMap.set(g.to._key, g.to);
  }

  const kbHits = await qdrant.search(QDRANT_COLLECTIONS.BUSINESS, {
    vector: queryEmbedding,
    filter: {
      must: [
        { key: 'channelId', match: { value: channelId } },
        { key: 'enabled', match: { value: true } },
      ],
    },
    limit: opts.topKB,
    with_payload: true,
  });

  const kbKeys = kbHits.map((h) => (h.payload as { docKey?: string }).docKey).filter((k): k is string => typeof k === 'string');
  const kbDocs = await listByChannel(channelId);
  const kbMap = new Map<string, BusinessDoc>();
  for (const k of kbDocs) kbMap.set(k._key, k);

  const candidates: RankCandidate[] = [
    ...memoryHits.map((h) => ({
      id: hashKeyToQdrantId((h.payload as { entityKey?: string }).entityKey ?? ''),
      type: 'memory' as const,
      key: (h.payload as { entityKey?: string }).entityKey ?? '',
      name: (h.payload as { name?: string })?.name ?? '',
      category: (h.payload as { category?: string }).category ?? '',
      description: entityMap.get((h.payload as { entityKey?: string }).entityKey ?? '')?.content ?? '',
      freshness: entityMap.get((h.payload as { entityKey?: string }).entityKey ?? '')?.updatedAt ?? 0,
      score: h.score,
    })),
    ...kbHits.map((h) => ({
      id: hashKeyToQdrantId((h.payload as { docKey?: string }).docKey ?? ''),
      type: 'kb' as const,
      key: (h.payload as { docKey?: string }).docKey ?? '',
      name: (h.payload as { title?: string })?.title ?? '',
      category: (h.payload as { type?: string }).type ?? '',
      description: kbMap.get((h.payload as { docKey?: string }).docKey ?? '')?.content ?? '',
      score: h.score,
    })),
  ];

  const ranked = candidates.length > 0
    ? await llmReRank(userMessage, candidates, opts.reRankTopK)
    : [];

  const memories: RetrievedMemory[] = ranked
    .filter((r) => r.type === 'memory')
    .slice(0, opts.maxMemories)
    .map((r) => {
      const e = entityMap.get(r.key);
      return {
        key: r.key,
        name: r.name,
        category: r.category,
        content: e?.content ?? r.description,
        freshness: calculateFreshness(e?.updatedAt ?? Date.now()),
        confidence: e?.confidence ?? 0.7,
        source: 'vector' as const,
      };
    });

  const businessDocs: RetrievedKB[] = ranked
    .filter((r) => r.type === 'kb')
    .slice(0, opts.maxKB)
    .map((r) => {
      const d = kbMap.get(r.key);
      return {
        key: r.key,
        title: r.name,
        type: r.category,
        content: d?.content ?? r.description,
        score: r.score,
      };
    });

  return {
    memories,
    businessDocs,
    retrievalCacheAt: Date.now(),
  };
}

interface RankCandidate {
  id: number;
  type: 'memory' | 'kb';
  key: string;
  name: string;
  category: string;
  description: string;
  freshness?: number;
  score: number;
}

async function llmReRank(
  query: string,
  candidates: RankCandidate[],
  topK: number
): Promise<RankCandidate[]> {
  if (candidates.length <= topK) return candidates;

  const candidatesText = candidates
    .map((c, i) => `${i}. [${c.type}] ${c.name} (${c.category}): ${c.description.slice(0, 100)}`)
    .join('\n');

  const prompt = `Given the user's query, select up to ${topK} most relevant items.

Query: ${query}

Available items:
${candidatesText}

Return ONLY the indices (numbers), one per line. If none are relevant, return "NONE".`;

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a relevance ranker. Select the most relevant items.' },
      { role: 'user', content: prompt },
    ];
    const res = await chatCompletion({
      messages,
      temperature: 0.1,
      maxTokens: 200,
      timeoutMs: 15_000,
    });

    const indices = res.content
      .split('\n')
      .map((l) => parseInt(l.trim().match(/\d+/)?.[0] ?? '', 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < candidates.length)
      .slice(0, topK);

    if (indices.length === 0) return candidates.slice(0, topK);

    return indices.map((i) => candidates[i]);
  } catch {
    return candidates.slice(0, topK);
  }
}

export async function ensureBusinessKBIndexes(channelId: string): Promise<void> {
  const embedder = getEmbedder();
  const qdrant = getQdrant();
  await ensureQdrantCollection(QDRANT_COLLECTIONS.BUSINESS, embedder.vectorSize);
  await ensurePayloadIndexes();

  const docs = await listByChannel(channelId);
  if (docs.length === 0) return;

  const points = await Promise.all(
    docs.map(async (d) => ({
      id: hashKeyToQdrantId(d._key),
      vector: await embedder.embed(`${d.title}: ${d.content}`),
      payload: {
        channelId: d.channelId,
        type: d.type,
        docKey: d._key,
        title: d.title,
        enabled: d.enabled,
        updatedAt: d.updatedAt,
      },
    }))
  );

  await qdrant.upsert(QDRANT_COLLECTIONS.BUSINESS, { points, wait: true });
}