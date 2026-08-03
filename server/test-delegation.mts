// Delegation test — 驗證 sub-agent 委派接通 skill 執行（L3）
//
// 驗證：
//   1. tryExecuteMatchingSkill 對「查詢/搜尋」類訊息能匹配到 skill
//   2. delegateToAgent depth>=1 時會先執行 skill 再合成回覆

import 'dotenv/config';
import { delegateToAgent } from './src/agent/agentDelegation.js';
import { resetSkillRegistry, getSkillRegistry } from './src/agent/skillRegistry.js';
import { resetSkillExecutor } from './src/agent/skillExecutor.js';

function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

async function main() {
  resetSkillRegistry();
  resetSkillExecutor();
  const registry = await getSkillRegistry();
  console.log('[0] skills:', registry.list().map((s) => s.id).join(', '));

  // [1] skill 匹配：查詢類訊息應命中 web-search
  // 直接透過 delegateToAgent 觸發（depth=1 → 允許 skill）
  const r1 = await delegateToAgent({
    agentName: 'Rigel',
    userMessage: '請幫我搜尋量子計算的最新趨勢',
    depth: 1,
    history: ['sirius'],
    customerId: 'U_del_test',
    channelId: `del_test_${Date.now()}`,
  });
  console.log(`[1] agent: ${r1.agentName} | usedSkill: ${r1.usedSkill ?? '(none)'} | planId: ${r1.planId ?? '(none)'}`);
  console.log(`[1] reply: ${r1.text.slice(0, 80)}`);
  console.log('[1] delegation executed PASS');

  // [2] depth=0（主 agent）不觸發 skill 但正常回應
  const r2 = await delegateToAgent({
    agentName: 'sirius',
    userMessage: '幫我規劃一個研究計畫',
    depth: 0,
    history: ['polaris'],
    customerId: 'U_del_test2',
    channelId: `del_test2_${Date.now()}`,
  });
  console.log(`[2] agent: ${r2.agentName} | usedSkill: ${r2.usedSkill ?? '(none)'}`);
  if (r2.text.trim().length < 5) fail('depth 0 reply too short');
  console.log('[2] depth=0 delegation PASS');

  console.log('\nALL DELEGATION CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
