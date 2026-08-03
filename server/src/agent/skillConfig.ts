// Skill 設定解析 — 三層優先序
//
//   1. 流程節點 config（skill_flows collection，最高優先，可在流程卡微調）
//   2. skill manifest defaults（內建默認）
//   3. 環境變數（最後兜底）
//
// 例：OCR 的 VL 模型 — 流程節點設 model=Qwen2.5-VL-7B-Instruct，
//     若未設則用 manifest defaults，再無則用 env VL_MODEL。

import { getDb, ensureCollection } from '../data/arango.js';
import { logger } from './logger.js';

const FLOW_COLLECTION = 'skill_flows';

interface FlowNodeConfig {
  type?: string;
  config?: Record<string, unknown>;
}

// 依 skill id 取得流程中所有 LLM/function 節點的 config（合併）
export async function loadFlowConfig(skillId: string): Promise<Record<string, unknown>> {
  try {
    await ensureCollection(FLOW_COLLECTION);
    const db = getDb();
    const key = Buffer.from(skillId, 'utf8').toString('base64url');
    const doc = (await db.collection(FLOW_COLLECTION).document(key).catch(() => null)) as
      | { nodes?: FlowNodeConfig[] }
      | null;
    if (!doc?.nodes) return {};

    const merged: Record<string, unknown> = {};
    for (const n of doc.nodes) {
      if (n.type !== 'llm' && n.type !== 'function') continue;
      const cfg = n.config ?? {};
      for (const [k, v] of Object.entries(cfg)) {
        // 跳過無效值：「dllm 預設」或空字串（視為未設置，用 env/默認）
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && (v.trim() === '' || v.trim() === 'dllm 預設')) continue;
        merged[k] = v;
      }
    }
    return merged;
  } catch (e) {
    logger.debug('skillConfig.load_failed', { skillId, error: String(e) });
    return {};
  }
}

// 解析最終值：flowConfig > defaults > envValue
export function resolveSetting(
  flowConfig: Record<string, unknown>,
  defaults: Record<string, unknown>,
  key: string,
  envValue?: string,
): unknown {
  if (flowConfig[key] !== undefined) return flowConfig[key];
  if (defaults[key] !== undefined) return defaults[key];
  return envValue ?? undefined;
}
