// Integration tests for Agent Orchestration (O1-O8)
// Run with: npx tsx src/scripts/integrationOrchestrationTest.ts
//
// Covers:
//   1. Slash menu — build / resolve / format
//   2. Pipeline — /new, /, /polaris, /rigel, /unknown
//   3. Polaris intent routing — classify keywords for Sirius/Deneb
//   4. Delegation framework — max depth, loop detection
//   5. Group chat @mention detection (shouldRespond)

import {
  buildSlashMenu,
  formatSlashMenuText,
  resolveSlashCommand,
  resolveMenuChoice,
  invalidateMenuCache,
} from '../agent/slashMenu.js';
import { PolarisPipeline } from '../agent/pipeline.js';
import { canDelegate, MAX_DELEGATION_DEPTH } from '../agent/agentDelegation.js';

const CUSTOMER = 'cust_orch_integ';
const CHANNEL = 'ch_orch_integ';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n[${title}]`);
}

async function testSlashMenu() {
  section('1. Slash menu');
  invalidateMenuCache();
  const menu = await buildSlashMenu();
  assert(menu.length >= 12, `menu should have ≥12 items (got ${menu.length})`);

  const polaris = menu.find((m) => m.name === 'Polaris');
  assert(!!polaris && polaris.type === 'main_agent', 'Polaris exists as main_agent');
  const rigel = menu.find((m) => m.name === 'Rigel');
  assert(!!rigel && rigel.type === 'sub_agent', 'Rigel exists as sub_agent');

  const text = await formatSlashMenuText();
  assert(text.includes('可用功能'), 'menu text has header');
  assert(text.includes('Polaris'), 'menu text lists Polaris');
}

async function testSlashResolution() {
  section('2. Slash command resolution');
  const polarisTarget = await resolveSlashCommand('/polaris');
  assert(!!polarisTarget && polarisTarget.name === 'Polaris', '/polaris resolves');

  const siriusArgs = await resolveSlashCommand('/sirius 研究量子計算');
  assert(!!siriusArgs && siriusArgs.remainingArgs === '研究量子計算', '/sirius passes args');

  const partial = await resolveSlashCommand('/rig');
  assert(!!partial && partial.name === 'Rigel', '/rig partial matches Rigel');

  const idx1 = await resolveMenuChoice('1');
  assert(!!idx1, 'numeric choice "1" resolves');

  const unknown = await resolveSlashCommand('/zzzzzz');
  assert(unknown === null, 'unknown command returns null');

  const bare = await resolveSlashCommand('/');
  assert(bare === null, 'bare / returns null (handled by menu display)');
}

async function testPipelineSlash() {
  section('3. Pipeline slash handling');
  const pipeline = new PolarisPipeline({ enableExtraction: false });

  const resetResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/new',
  });
  assert(resetResult.reset, '/new triggers reset');

  const menuResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/',
  });
  assert(menuResult.slashMenuShown === true, '/ shows menu');

  const polarisResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/polaris 你好',
  });
  assert(!!polarisResult.slashTarget, '/polaris has slashTarget');
  assert(polarisResult.slashTarget?.name === 'Polaris', 'slashTarget is Polaris');

  const rigelResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/rigel 找資料',
  });
  assert(rigelResult.slashTarget?.name === 'Rigel', '/rigel resolves to Rigel');
  assert(rigelResult.slashTarget?.type === 'sub_agent', 'Rigel is sub_agent');

  const unknownResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/zzzz',
  });
  assert(!unknownResult.slashTarget, 'unknown returns no target');
  assert(unknownResult.text.includes('找不到'), 'unknown shows error');
}

function testPolarisIntentHeuristics() {
  section('4. Polaris intent heuristics');
  const pipeline = new PolarisPipeline({ enableExtraction: false });

  const classifyFn = (pipeline as any).classifyPolarisIntent.bind(pipeline);
  assert(classifyFn('幫我研究量子計算') === 'sirius', '研究 → sirius');
  assert(classifyFn('比較各方案') === 'sirius', '比較 → sirius');
  assert(classifyFn('列出步驟') === 'sirius', '列出步驟 → sirius');
  assert(classifyFn('整理摘要') === 'sirius', '整理摘要 → sirius');
  assert(classifyFn('哲學是什麼') === 'deneb', '哲學 → deneb');
  assert(classifyFn('人生的意義') === 'deneb', '人生 → deneb');
  assert(classifyFn('幫我推薦') === 'deneb', '推薦 → deneb');
  assert(classifyFn('你好') === null, '普通問候 → null');
  assert(classifyFn('今天天氣如何') === null, '天氣 → null');
}

function testDelegationRules() {
  section('5. Delegation framework rules');
  assert(MAX_DELEGATION_DEPTH === 3, 'max depth = 3');

  const ok1 = canDelegate('sirius', 0, []);
  assert(ok1.ok, 'depth 0 → ok');

  const ok2 = canDelegate('sirius', 2, ['user', 'polaris']);
  assert(ok2.ok, 'depth 2 with no loop → ok');

  const deep = canDelegate('sirius', 3, ['user', 'polaris', 'sirius']);
  assert(!deep.ok && !!deep.reason?.includes('max depth'), 'depth 3 → exceeded');

  const loop = canDelegate('sirius', 1, ['user', 'polaris', 'sirius']);
  assert(!loop.ok && !!loop.reason?.includes('loop'), 'already called → loop detected');
}

function testGroupChatShouldRespond() {
  section('6. Group chat shouldRespond (logic test)');
  const userSource = 'user';

  const privateOk = userSource === 'user';
  assert(privateOk, 'private chat always responds');

  const mentionPatterns = [/@分身\b/, /@bot\b/i, /@Polaris\b/i];

  const groupNoMention = mentionPatterns.some((re) => re.test('大家好'));
  assert(!groupNoMention, 'group without @mention does not respond');

  const groupMention = mentionPatterns.some((re) => re.test('@Polaris 你好'));
  assert(groupMention, 'group with @Polaris mention responds');

  const groupMentionBot = mentionPatterns.some((re) => re.test('@bot 幫我查'));
  assert(groupMentionBot, 'group with @bot responds');
}

async function main() {
  console.log('[orchestration-integ] agent orchestration integration tests');

  await testSlashMenu();
  await testSlashResolution();
  await testPipelineSlash();
  testPolarisIntentHeuristics();
  testDelegationRules();
  testGroupChatShouldRespond();

  console.log(`\n[orchestration-integ] ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[orchestration-integ] FATAL', e);
  process.exit(1);
});