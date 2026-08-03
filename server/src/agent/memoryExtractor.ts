// Altair Memory Extractor
//
// 從對話抽 entities + relationships，過濾 PII / forbidden，寫入 ArangoDB + Qdrant
//
// 流程：
//   1. 用 prompt 呼叫 LLM（gpt-4o-mini 便宜）
//   2. 解析 JSON 輸出
//   3. 每個 entity 過 PII/forbidden filter
//   4. Embed + 寫 ArangoDB
//   5. 寫 Qdrant
//   6. Relationships 寫 edge collection

import { chatCompletion, type ChatMessage } from './llmClient.js';
import { filterContent, redactPII } from './contentFilter.js';
import {
  upsertEntity,
  generateEntityKey,
  listEntitiesByCustomer,
  markSuperseded,
  type MemoryEntity,
  type MemoryCategory,
} from '../data/memoryRepo.js';
import {
  createRelationship,
  deleteRelationshipsFor,
  type MemoryRelationship,
  type RelationshipType,
} from '../data/relationshipRepo.js';
import { getEmbedder } from '../lib/embedder.js';
import { getQdrant, QDRANT_COLLECTIONS, ensureQdrantCollection, ensurePayloadIndexes } from '../lib/qdrant.js';

export interface ExtractedEntity {
  name: string;
  category: MemoryCategory;
  content: string;
  evidence: string;
  confidence: number;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  type: RelationshipType;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  superseded: Array<{ old_name: string; new_name: string }>;
}

const SYSTEM_PROMPT = `你是 Altair — 圖譜記憶管理者。從對話抽 entities + relationships。

## 規則

1. 抽 entities：人、事、物、偏好、話題、產品、地點、時間
2. 抽 relationships：誰-喜歡-什麼、誰-住在-哪裡、什麼-相關於-什麼
3. 每個 entity：name、category、content、evidence、confidence
4. category 必須是: 'preference' | 'fact' | 'style' | 'event'

## 禁止記錄

- 代碼模式、文件路徑
- 寒暄（你好、謝謝、再見）
- 臨時任務、調試細節
- 可從對話推導的常識
- 個資（PII）：電話、地址、身分證、信用卡

## 取代規則

- 客戶改變心意時，把舊 entity supersededBy 指向新
- 客戶說「我不再是 X 了」→ superseded

## 輸出 JSON

{
  "entities": [
    {
      "name": "...",
      "category": "preference",
      "content": "...",
      "evidence": "對話原句",
      "confidence": 0.85
    }
  ],
  "relationships": [
    {
      "source": "entity_name_1",
      "target": "entity_name_2",
      "type": "prefers"
    }
  ],
  "superseded": [
    { "old_name": "...", "new_name": "..." }
  ]
}`;

export interface ExtractionInput {
  customerId: string;
  channelId: string;
  messages: Array<{ role: 'user' | 'agent'; content: string; at: number }>;
}

export interface ExtractionSummary {
  extracted: number;
  saved: number;
  filtered: number;
  relationships: number;
  durationMs: number;
}

/**
 * Extract memories from messages via LLM and persist.
 * Safe to call concurrently (per-customer serialization recommended at caller).
 */
export async function extractAndPersist(input: ExtractionInput): Promise<ExtractionSummary> {
  const start = Date.now();
  const embedder = getEmbedder();
  const qdrant = getQdrant();

  await ensureQdrantCollection(QDRANT_COLLECTIONS.MEMORIES, embedder.vectorSize);
  await ensurePayloadIndexes();

  const transcript = input.messages
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `對話 transcript：\n\n${transcript}` },
  ];

  const llmResult = await chatCompletion({
    messages,
    temperature: 0.1,
    maxTokens: 2000,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(llmResult.content);
  } catch (e) {
    throw new Error(
      `LLM returned invalid JSON: ${llmResult.content.slice(0, 200)} (${e instanceof Error ? e.message : String(e)})`
    );
  }

  const existing = await listEntitiesByCustomer(input.customerId, { includeForgotten: true });

  const entityNameToKey = new Map<string, string>();
  for (const e of existing) {
    if (!e.forgotten) entityNameToKey.set(e.name, e._key);
  }

  let saved = 0;
  let filtered = 0;
  const newKeys: string[] = [];

  for (const ent of parsed.entities ?? []) {
    if (ent.confidence < 0.5) {
      filtered++;
      continue;
    }
    const evidenceCheck = filterContent(ent.evidence ?? '');
    const contentCheck = filterContent(ent.content ?? '');
    if (!evidenceCheck.passed || !contentCheck.passed) {
      filtered++;
      continue;
    }
    const safeContent = redactPII(ent.content);
    const safeEvidence = redactPII(ent.evidence);

    const key = entityNameToKey.get(ent.name) ?? generateEntityKey(input.customerId, ent.name);
    const embedding = await embedder.embed(`${ent.name}: ${safeContent}`);

    const entity: Omit<MemoryEntity, 'createdAt' | 'updatedAt'> = {
      _key: key,
      customerId: input.customerId,
      channelId: input.channelId,
      name: ent.name,
      category: ent.category,
      content: safeContent,
      evidence: safeEvidence,
      confidence: ent.confidence,
      source: 'extracted',
      forgotten: false,
    };

    await upsertEntity(entity);

    await qdrant.upsert(QDRANT_COLLECTIONS.MEMORIES, {
      points: [
        {
          id: hashKeyToQdrantId(key),
          vector: embedding,
          payload: {
            customerId: input.customerId,
            channelId: input.channelId,
            category: ent.category,
            entityKey: key,
            confidence: ent.confidence,
            updatedAt: Date.now(),
          },
        },
      ],
    });

    entityNameToKey.set(ent.name, key);
    newKeys.push(key);
    saved++;
  }

  for (const rel of parsed.relationships ?? []) {
    const fromKey = entityNameToKey.get(rel.source);
    const toKey = entityNameToKey.get(rel.target);
    if (!fromKey || !toKey || fromKey === toKey) continue;
    try {
      await createRelationship({
        _from: fromKey,
        _to: toKey,
        type: rel.type,
        confidence: 0.8,
      });
    } catch {
      // ignore duplicate edges
    }
  }

  for (const sup of parsed.superseded ?? []) {
    const oldKey = entityNameToKey.get(sup.old_name);
    const newName = sup.new_name;
    const newKey = entityNameToKey.get(newName);
    if (!oldKey || !newKey) continue;
    await deleteRelationshipsFor(oldKey);
    await markSuperseded(oldKey, newKey);
  }

  return {
    extracted: (parsed.entities ?? []).length,
    saved,
    filtered,
    relationships: (parsed.relationships ?? []).length,
    durationMs: Date.now() - start,
  };
}

/* ── Async queue ── */

type QueueItem = ExtractionInput;
const queue: QueueItem[] = [];
let processing = false;

export function enqueueExtraction(input: ExtractionInput): void {
  queue.push(input);
  if (!processing) {
    processing = true;
    setImmediate(drainQueue);
  }
}

async function drainQueue(): Promise<void> {
  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      await extractAndPersist(item);
    } catch (e) {
      console.error('[altair] extraction failed', e);
    }
  }
  processing = false;
}

function hashKeyToQdrantId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}