// Pluggable Embedder
//
// 介面設計讓實作可替換：
//   - DllmEmbedder (bge-m3) — 優先，本地 dllm 提供（1024 dim）
//   - OpenAIEmbedder (text-embedding-3-small) — 若 DLLM 不可用且有 OPENAI_API_KEY
//   - OllamaEmbedder (bge-m3) — 若 Ollama 在線
//   - HashEmbedder (deterministic fallback) — 測試用，永遠可運作
//
// 透過 getEmbedder() 自動選擇。

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DLLM_BASE_URL = process.env.LLM_API_BASE || 'http://localhost:11400/v1';
const DLLM_API_KEY = process.env.LLM_API_KEY || '';
const EMBED_MODEL = process.env.EMBED_MODEL || 'bge-m3';

export type Vector = number[];
export type VectorBatch = Array<Vector>;

export interface Embedder {
  readonly name: string;
  readonly vectorSize: number;
  embed(text: string): Promise<Vector>;
  embedBatch(texts: string[]): Promise<VectorBatch>;
}

/* ── Dllm (bge-m3) ── */

export class DllmEmbedder implements Embedder {
  readonly name = 'dllm-bge-m3';
  readonly vectorSize = 1024;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = DLLM_BASE_URL, model: string = EMBED_MODEL) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async embed(text: string): Promise<Vector> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(DLLM_API_KEY ? { Authorization: `Bearer ${DLLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`dllm embed failed: ${res.status}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<VectorBatch> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(DLLM_API_KEY ? { Authorization: `Bearer ${DLLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`dllm embed failed: ${res.status}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

/* ── OpenAI ── */

export class OpenAIEmbedder implements Embedder {
  readonly name = 'openai-text-embedding-3-small';
  readonly vectorSize = 1536;

  async embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<VectorBatch> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

/* ── Ollama bge-m3 ── */

export class OllamaEmbedder implements Embedder {
  readonly name = 'ollama-bge-m3';
  readonly vectorSize = 1024;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL, model: string = 'bge-m3') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async embed(text: string): Promise<Vector> {
    const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const data = (await res.json()) as { embeddings: Vector[] };
    return data.embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<VectorBatch> {
    const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const data = (await res.json()) as { embeddings: Vector[] };
    return data.embeddings;
  }
}

/* ── Hash fallback（deterministic，僅供測試 / 離線） ── */

export class HashEmbedder implements Embedder {
  readonly name = 'hash-fallback';
  readonly vectorSize = 384;

  async embed(text: string): Promise<number[]> {
    return this.hashToVector(text, this.vectorSize);
  }

  async embedBatch(texts: string[]): Promise<VectorBatch> {
    return texts.map((t) => this.hashToVector(t, this.vectorSize));
  }

  private hashToVector(text: string, dim: number): number[] {
    const vec = new Array(dim).fill(0);
    const normalized = text.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (charCode * 31 + i * 17) % dim;
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

/* ── Selector ── */

let cached: Embedder | undefined;

export function getEmbedder(): Embedder {
  if (cached) return cached;

  if (DLLM_API_KEY || DLLM_BASE_URL) {
    cached = new DllmEmbedder();
    return cached;
  }

  if (OPENAI_API_KEY) {
    cached = new OpenAIEmbedder();
    return cached;
  }

  cached = new HashEmbedder();
  return cached;
}

export function resetEmbedder(): void {
  cached = undefined;
}