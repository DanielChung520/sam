# sam 記憶與上下文管理 — 最終設計（融合 aibox-th + 業界）

> 版本：v0.2
> 日期：2026-07-30
> 狀態：**已融合 aibox-th hybrid_rag 經驗 + 業界共識，準備實作**
> 維護者：Sisyphus / user
> 基於：[`.docs/AGENT_LAYER_ARCHITECTURE.md`](AGENT_LAYER_ARCHITECTURE.md) / [`.docs/AGENT_ARCHITECTURE_AND_FLOW.md`](AGENT_ARCHITECTURE_AND_FLOW.md)

---

## 0. 設計原則（LINE 分身 + 低頻對話）

1. **LINE 聊天室 = 永久容器**，不像 ChatGPT 有「New Chat」reset
2. **頻率低**（user 一天回來 1-3 次）→ 萃取可 async，背景跑 gpt-4o-mini 沒問題
3. **滑動視窗 + 圖譜記憶** = 既保留近期 context，又累積長期知識
4. **條件注入** = 只 retrieve 相關記憶，不灌全部 context
5. **`/new` = user 明確 reset**（清 L1，保留 L2）

---

## 1. 業界參考來源

| 來源 | 採用 |
|------|------|
| **aibox-th memory_agent** | 4 類記憶分類、INDEX pattern、forbidden patterns filter、LLM relevance filtering |
| **aibox-th hybrid_rag** | Qdrant + ArangoDB hybrid retrieval、bge-m3 embedding、多策略融合 |
| **Microsoft GraphRAG** | Entity + relationship extraction、community detection |
| **Zep** | Async memory extraction、freshness labels（"3 days ago"）|
| **Letta / MemGPT** | Core/archival/recall 三層分離 |
| **Cognee** | Knowledge graph + vector hybrid |

---

## 2. 三層記憶架構（最終版）

```
LINE 聊天室（永久）
    ↓
┌──────────────────────────────────────────────────────────────┐
│ L1 滑動視窗 — Redis                                          │
│   - 最近 50 則訊息（25 輪對話）                              │
│   - 不分 cluster、沒有 TTL（除非 /new）                      │
│   - 訊息滑出視窗 → 觸發 L2 萃取                              │
└──────────────────────────────────────────────────────────────┘
                            ↓ async extraction (by Altair)
┌──────────────────────────────────────────────────────────────┐
│ L2 圖譜記憶庫 — ArangoDB graph + Qdrant                     │
│                                                              │
│   A. Entities（頂點）:                                       │
│      category: 'preference' | 'fact' | 'style' | 'event'    │
│      每個 entity 有: embedding (Qdrant) + metadata (Arango)  │
│                                                              │
│   B. Relationships（邊）:                                    │
│      type: 'prefers' | 'related_to' | 'happened_on' | ...  │
│      source → target + confidence + recency                  │
│                                                              │
│   C. Forbidden Patterns Filter（aibox-th 經驗）             │
│      不存：寒暄、greeting、thx、code pattern、derivable info│
└──────────────────────────────────────────────────────────────┘
                            ↓ on each message
┌──────────────────────────────────────────────────────────────┐
│ L3 Business KB — ArangoDB + Qdrant                          │
│   - 業務員手動維護（產品/價目/FAQ）                          │
│   - embedding 索引                                           │
│   - retrieval 時注入                                         │
└──────────────────────────────────────────────────────────────┘
                            ↓ retrieval pipeline
┌──────────────────────────────────────────────────────────────┐
│ L4 Retrieval Pipeline — Polaris Phase 1                     │
│   1. Embed 當下訊息（bge-m3）                                │
│   2. Qdrant 撈 L2 entities → top 20                         │
│   3. ArangoDB graph traversal → 1-2 hop 鄰居                │
│   4. Qdrant 撈 L3 KB → top 5                                │
│   5. LLM re-rank（gpt-4o-mini 篩 top 5 entities + 3 KB）    │
│   6. 格式化為 context block                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 資料模型（最終版）

### 3.1 L1 Conversation Window（Redis）

```typescript
interface Conversation {
  _key: string;                // 'sam:conv:{channelId}:{customerId}'
  channelId: string;
  customerId: string;          // Person Token

  messages: Array<{
    role: 'user' | 'agent' | 'system';
    content: string;
    at: number;
    intent?: string;
    taskIds?: string[];
    sources?: string[];        // retrieved memory IDs / KB IDs
  }>;

  // 注入 context（cached for this conversation）
  retrievedMemories: string[];  // L2 entity IDs
  retrievedBusiness: string[];  // L3 KB IDs
  retrievalCacheAt: number;

  state: ConversationState;
  // ... 其餘同原設計
}
```

### 3.2 L2 Memory Entities（ArangoDB graph）

```typescript
interface MemoryEntity {
  _key: string;                // 'mem:{customerId}:{timestamp}:{slug}'
  customerId: string;
  channelId: string;

  name: string;                // '香菜=討厭'
  category: 'preference' | 'fact' | 'style' | 'event';
  content: string;             // 'user 明確說討厭香菜'
  evidence: string;            // 對話原句

  confidence: number;          // 0-1
  source: 'extracted' | 'user_stated' | 'admin_added';
  embedding?: number[];        // 同步寫入 Qdrant

  // 時間
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;          // event 類 180 天

  // 維護
  supersededBy?: string;       // 被取代時指向
  forgotten?: boolean;
}

interface MemoryRelationship {
  _key: string;
  _from: string;               // entity _key
  _to: string;                 // entity _key
  type: 'prefers' | 'related_to' | 'happened_on' | 'owns' | 'discussed';
  confidence: number;
  evidence?: string;
  createdAt: number;
}
```

### 3.3 L2 索引（Qdrant）

```
collection: sam_memories
vector: 1024 dim (bge-m3)
payload: {
  customerId: string,
  channelId: string,
  category: string,
  entityKey: string,  // → ArangoDB _key
  confidence: number,
  updatedAt: number
}
```

### 3.4 L3 Business KB（ArangoDB + Qdrant）

```typescript
interface BusinessDoc {
  _key: string;                // 'kb:{channelId}:{slug}'
  channelId: string;
  type: 'product' | 'pricing' | 'faq' | 'policy' | 'menu';
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  embedding?: number[];

  createdAt: number;
  updatedAt: number;
}
```

---

## 4. Altair 萃取流程（融合 aibox-th + GraphRAG）

### 4.1 觸發時機

```
L1 訊息滑出視窗（#51 進來時 #1 滑出）
    ↓
背景觸發 Altair.extract(customerId, [messages_to_extract])
    ↓
非同步處理（用 in-memory queue + setImmediate）
```

**為什麼滑出時觸發**：
- 自然節流（低頻 → 萃取頻率也低）
- 不依賴 session 結束事件（LINE 沒有）
- aibox-th 也用過類似 sliding window pattern

### 4.2 萃取 LLM Prompt

```
你是 Altair — 圖譜記憶管理者。從對話抽 entities + relationships。

## 規則

1. 抽 entities：人、事、物、偏好、話題、產品、地點、時間
2. 抽 relationships：誰-喜歡-什麼、誰-住在-哪裡、什麼-相關於-什麼
3. 每個 entity：name、category、content、evidence、confidence
4. category: 'preference' | 'fact' | 'style' | 'event'

## 禁止記錄（aibox-th forbidden patterns）

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
}
```

### 4.3 萃取後處理 Pipeline

```
1. 呼叫 LLM（gpt-4o-mini）
2. PII 過濾（regex 過濾）
3. Forbidden patterns 過濾
4. Embedding 生成（bge-m3）
5. 寫入 ArangoDB graph（entities + relationships）
6. 同步寫入 Qdrant
7. 標記 superseded（更新舊 entity 的 supersededBy）
8. 刪除 Redis 中被滑出的訊息（保留 summary）
```

---

## 5. Retrieval Pipeline（融合 aibox-th hybrid_rag + Zep freshness）

### 5.1 完整流程

```typescript
async function retrieveContext(
  customerId: string,
  channelId: string,
  userMessage: string
): Promise<RetrievedContext> {
  // 1. Embed message (bge-m3, 1024 dim)
  const embedding = await embedWithBGE(userMessage);

  // 2. L2 search — Qdrant 撈 top 20 entities
  const topEntities = await qdrant.search('sam_memories', {
    vector: embedding,
    filter: { customerId, forgotten: false },
    limit: 20,
  });

  // 3. Graph traversal — 拿 1-hop 鄰居
  const subgraph = await arango.query(`
    FOR v IN ${topEntities.map(e => `"${e.entityKey}"`).join(',')}
      FOR neighbor IN 1..1 ANY v memoryGraph
        RETURN { from: v, to: neighbor, type: neighbor._edge.type }
  `);

  // 4. L3 search — Qdrant 撈 top 5 KB
  const topKB = await qdrant.search('sam_business', {
    vector: embedding,
    filter: { channelId, enabled: true },
    limit: 5,
  });

  // 5. LLM re-rank (gpt-4o-mini, 學 aibox-th 的做法)
  const candidates = formatCandidates(topEntities, subgraph, topKB);
  const ranked = await llmReRank(userMessage, candidates, topK=5);

  // 6. Format as context with freshness
  return {
    memories: ranked.entities.map(e => ({
      content: e.content,
      freshness: calculateFreshness(e.updatedAt),  // "3 days ago"
      confidence: e.confidence,
    })),
    businessDocs: ranked.kb.slice(0, 3),
  };
}
```

### 5.2 LLM Re-rank Prompt（學 aibox-th）

```
Given the user's query, select up to 5 relevant memories/KB items.

Query: {user_message}

Available items:
- [{category}] mem_xxx (3 days ago): {description}
- [{type}] kb_yyy: {title}
...

Select items that are relevant to the query. Return only the IDs, one per line.
If none are relevant, return "NONE".
```

### 5.3 Freshness 格式（學 Zep / aibox-th）

```typescript
function calculateFreshness(updatedAt: number): string {
  const days = Math.floor((Date.now() - updatedAt) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
```

---

## 6. Context Assembly（Polaris Phase 1）

```typescript
const messages = [
  { role: 'system', content: `
    你是 Polaris — 對話編排者。

    ## 關於這個客戶的記憶
    ${retrievedContext.memories.map(m => `- ${m.content}（${m.freshness}）`).join('\n')}

    ## 相關業務知識
    ${retrievedContext.businessDocs.map(k => `- ${k.title}：${k.content}`).join('\n')}
  `},
  ...recentMessages,  // L1 sliding window
  { role: 'user', content: userMessage },
];
```

**業界共識**：
- 記憶 + KB 放在 system prompt（不是 messages）— 一致性高
- 帶 freshness — 模型知道時效
- token budget 控制（總和 < model.context_window × 0.7）

---

## 7. `/new` 指令語義

```
user: "/new"
    ↓
1. 清空 L1: messages = []
2. 清空 retrievedMemories / retrievedBusiness cache
3. State → IDLE
4. 回應：「好的，讓我們重新開始。有什麼可以幫您？」

下次 user 訊息 → 重新做 retrieval（從 L2 + L3 撈）
L2 資料庫不動 — user 不希望分身忘記他
```

---

## 8. 實作優先序（最終）

| # | 工作 | 工作量 | 影響 |
|---|------|--------|------|
| **G1** | 資料模型：`MemoryEntity`、`MemoryRelationship`、`BusinessDoc` + ArangoDB graph | 1 天 | 圖譜 |
| **G2** | Qdrant collections：`sam_memories` + `sam_business` + embedding pipeline | 0.5 天 | 向量檢索 |
| **G3** | Altair 萃取 prompt + LLM 呼叫 + PII/forbidden 過濾 | 1 天 | 自動萃取 |
| **G4** | Altair 寫入 ArangoDB + 同步 Qdrant + 滑出視窗觸發 | 1 天 | 萃取完整 |
| **G5** | Retrieval pipeline：embed → Qdrant → graph traversal → LLM re-rank | 1.5 天 | 核心 |
| **G6** | Polaris Phase 1 整合（注入 retrieved context） | 0.5 天 | context 注入 |
| **G7** | `/new` 指令 + L1 reset 邏輯 | 0.5 天 | user 控制 |
| **G8** | User API：`GET/DELETE /api/v1/memories`（user 查詢 + 忘記我）| 0.5 天 | 合規 |
| **G9** | Admin viewer：`/admin/memories`（admin 看 user memory）| 0.5 天 | debug |
| **G10** | 整合測試（multi-session、retrieval 品質、PII 過濾）| 1 天 | 品質 |

**總計約 8 天**，分三輪：

| 輪 | 工作 | 天數 |
|---|------|------|
| **第一輪** | G1 + G2 + G3 + G4 — 圖譜 + 萃取 | 3.5 天 |
| **第二輪** | G5 + G6 + G7 — Retrieval + 注入 + /new | 2.5 天 |
| **第三輪** | G8 + G9 + G10 — API + Viewer + 測試 | 2 天 |

---

## 9. 待實作的檔案

### Server 新檔

| 檔案 | 用途 |
|------|------|
| `server/src/data/memoryRepo.ts` | Memory entity CRUD（ArangoDB） |
| `server/src/data/relationshipRepo.ts` | Relationship CRUD |
| `server/src/data/businessDocRepo.ts` | L3 KB CRUD |
| `server/src/lib/qdrant.ts` | Qdrant client wrapper |
| `server/src/lib/embedder.ts` | bge-m3 embedding 呼叫 |
| `server/src/agent/memoryExtractor.ts` | Altair 萃取邏輯（含 prompt + 過濾） |
| `server/src/agent/contextRetriever.ts` | Retrieval pipeline |
| `server/src/agent/slidingWindow.ts` | L1 視窗管理 |
| `server/src/routes/memories.ts` | User memory API |
| `server/src/routes/adminMemories.ts` | Admin viewer |
| `server/src/routes/businessDocs.ts` | L3 KB CRUD |

### Server 修改檔

| 檔案 | 修改 |
|------|------|
| `server/src/agent/agent.ts` | Polaris Phase 1 整合 context retriever |
| `server/src/agent/stateStore.ts` | L1 改 sliding window（去掉 TTL） |
| `server/src/data/agentRepo.ts` | Altair prompts 加重記憶章節 |
| `server/src/index.ts` | 註冊新 routes |

### Admin 新檔

| 檔案 | 用途 |
|------|------|
| `admin/src/pages/Memories.tsx` | Memory viewer（admin 看 user memory） |
| `admin/src/pages/BusinessDocs.tsx` | L3 KB CRUD |

---

## 10. 風險與緩解（融合 aibox-th 經驗）

| 風險 | 緩解 |
|------|------|
| 圖譜膨脹太快 | confidence < 0.5 的 entity 90 天後 archive |
| 萃取品質不穩 | forbidden patterns + PII filter + JSON schema validation |
| Retrieval 慢 | cached per conversation（不重做） |
| 隱私疑慮 | 不存原始對話、只存 entities、user 可查可刪 |
| Cold start | 第一則訊息立即觸發輕量萃取 |
| bge-m3 不在線 | fallback 到 OpenAI text-embedding-3-small |

---

## 11. 待 user 確認問題

1. **bge-m3 作為 embedding** — 採 aibox-th 一致的本地 Ollama 模型，同意嗎？還是改用 OpenAI？
2. **G8 user `/memory` API** — 也要在第一輪就做嗎？還是放第三輪？
3. **Admin memory viewer** — 業務員看得到 user 的 memory 嗎？（隱私 vs debug 取捨）

---

## 12. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-30 v0.1 | 初版，基於業界共識 |
| 2026-07-30 v0.2 | 融合 aibox-th hybrid_rag + memory_agent 經驗，加入 forbidden patterns、INDEX pattern、LLM re-rank、bge-m3 |