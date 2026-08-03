// OCR skill 單元測試 — 用 test-results/ 下的真實圖片
//
// 情境：
//   - channelId: test001
//   - 圖片來源: sam/test-results/（名片 ×2 / 祝福賀卡 / 問安卡 / 其他 ×2）
//   - 驗證: ocr skill 輸出結構化 JSON（summary/type/名片欄位/問候/節慶/文字）

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { getSkillRegistry } from './src/agent/skillRegistry.js';
import { getSkillExecutor } from './src/agent/skillExecutor.js';
import { getFileStorage } from './src/lib/fileStorage.js';

const CHANNEL_ID = 'test001';
const IMG_DIR = '/home/daniel/github/sam/test-results';

interface TestCase {
  file: string;
  expectType: '名片' | '問安卡' | '祝福賀卡' | '其他';
}

const CASES: TestCase[] = [
  { file: 'PICM深-吳品南-正.png', expectType: '名片' },
  { file: 'PICM白-郭慈力 -正.png', expectType: '名片' },
  { file: '2025双节同庆.png', expectType: '祝福賀卡' },
  { file: 'image12001.png', expectType: '問安卡' },
  { file: '泰雅族老者.png', expectType: '其他' },
  { file: 'Pallet-1.png', expectType: '其他' },
];

function conv(id: string) {
  return {
    id,
    userId: 'u_test',
    channelId: CHANNEL_ID,
    state: 'idle' as const,
    history: [],
    context: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 1000,
  };
}

async function main() {
  const reg = await getSkillRegistry();
  const skill = reg.get('ocr');
  if (!skill) throw new Error('ocr skill not found');
  const storage = getFileStorage();

  let pass = 0;
  let fail = 0;

  for (const c of CASES) {
    const storageKey = `${CHANNEL_ID}/test/${c.file}`;
    const img = readFileSync(`${IMG_DIR}/${c.file}`);
    await storage.put(storageKey, img, 'image/png');

    console.log(`\n=== ${c.file}（期望: ${c.expectType}）===`);
    const t = Date.now();
    const r = await getSkillExecutor().execute(
      skill,
      {
        media: { storageKey, mediaType: 'image', fileName: c.file },
        receivedAt: Date.now(),
      },
      conv(c.file) as any,
    );
    console.log(`  完成 ${((Date.now() - t) / 1000).toFixed(1)}s`);
    console.log(`  輸出:\n${r.output}`);

    // 驗證
    const okType = r.output.includes(c.expectType);
    const hasSummary = /📝|概述|摘要/.test(r.output);
    const hasTime = r.output.includes('⏱');
    const lineOK = okType && hasSummary && hasTime;
    console.log(`  驗證: type=${okType ? '✅' : '❌'} summary=${hasSummary ? '✅' : '❌'} time=${hasTime ? '✅' : '❌'} → ${lineOK ? 'PASS' : 'FAIL'}`);
    if (lineOK) pass++; else fail++;

    await storage.delete(storageKey);
  }

  console.log(`\n========== 結果: ${pass}/${CASES.length} PASS, ${fail} FAIL ==========`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});
