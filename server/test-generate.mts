// Generate-reply test — 驗證主對話走 LLM 生成（含記憶注入），不再回罐頭文字
//
// 前置：dllm 在線（LLM 可用）
// 驗證：
//   1. question intent 無 skill 匹配 → 回覆非罐頭文字（LLM 生成）
//   2. 有 systemContext（記憶）時，回覆內容應與 context 相關

import 'dotenv/config';
import { resetPolarisPipeline, getPolarisPipeline } from './src/agent/pipeline.js';
import { resetAgent } from './src/agent/agent.js';
import { resetSkillRegistry } from './src/agent/skillRegistry.js';
import { resetSkillExecutor } from './src/agent/skillExecutor.js';

function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

const CANNED = [
  '我目前需要更多 context 才能回答',
  '請問你想進一步了解哪一段',
  '我需要更多資訊才能幫你',
];

async function main() {
  resetAgent();
  resetPolarisPipeline();
  resetSkillRegistry();
  resetSkillExecutor();

  const pipeline = getPolarisPipeline({ enableRetrieval: false, enableExtraction: false });
  const channelId = `gen_test_${Date.now()}`;
  const userId = `U_gen_${Date.now()}`;

  // [1] question intent → 應為 LLM 生成，非罐頭
  const r1 = await pipeline.handleMessage({
    userId,
    channelId,
    text: '請問你們的產品有哪些特色？',
  });
  console.log(`[1] reply: ${r1.text.slice(0, 80)}`);
  const isCanned = CANNED.some((c) => r1.text.includes(c));
  if (isCanned) fail(`reply is canned text: ${r1.text}`);
  if (r1.text.trim().length < 5) fail('reply too short');
  console.log('[1] question → LLM generated reply PASS');

  // [2] 記憶注入（新 conversation，無歷史干擾）→ 回覆應提及記憶內容
  const ctxChannel = `gen_ctx_${Date.now()}`;
  const r2 = await pipeline.handleMessage({
    userId,
    channelId: ctxChannel,
    text: '你記得我上次說的事嗎？',
    systemContext: '## 關於這個客戶的記憶\n- [preference] 客戶偏好翡翠綠色的包裝（yesterday, 信心 90%）',
  });
  console.log(`[2] reply: ${r2.text.slice(0, 80)}`);
  if (r2.text.trim().length < 5) fail('reply too short');
  const mentionsContext = /翡翠|包裝|preference|偏好/.test(r2.text);
  console.log(`[2] mentions context: ${mentionsContext}`);
  if (!mentionsContext) fail('reply did not use injected memory context');
  console.log('[2] systemContext injected reply PASS');

  // [3] follow-up 追問 → 也應走生成
  const r3 = await pipeline.handleMessage({
    userId,
    channelId,
    text: '那個具體怎麼運作？',
  });
  console.log(`[3] reply: ${r3.text.slice(0, 80)}`);
  if (r3.text.trim().length < 5) fail('reply too short');
  console.log('[3] follow_up → LLM generated reply PASS');

  console.log('\nALL GENERATE-REPLY CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
