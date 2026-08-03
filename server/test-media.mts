// Media pipeline test — 驗證多媒體訊息分流 + 降級回應
//
// 不需要真實 LINE webhook：直接呼叫 pipeline.handleMessage 帶 media 欄位，
// 驗證 skill 路由正確（image→ocr, audio→stt, file→file-process）與降級回應文案。

import { resetPolarisPipeline, getPolarisPipeline } from './src/agent/pipeline.js';
import { resetAgent } from './src/agent/agent.js';
import { resetSkillRegistry, getSkillRegistry } from './src/agent/skillRegistry.js';
import { resetSkillExecutor } from './src/agent/skillExecutor.js';

function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

async function main() {
  resetAgent();
  resetPolarisPipeline();
  resetSkillRegistry();
  resetSkillExecutor();

  const registry = await getSkillRegistry();
  const ids = registry.list().map((s) => s.id);
  console.log('[1] registry skills:', ids.join(', '));

  const expected = ['ocr', 'greeting-card', 'file-process', 'stt'];
  for (const id of expected) {
    if (!ids.includes(id)) fail(`skill ${id} not registered`);
  }
  console.log('[1] all media skills registered OK');

  const pipeline = getPolarisPipeline({ enableRetrieval: false, enableExtraction: false });

  const channelId = `media_test_${Date.now()}`;
  const userId = `U_media_${Date.now()}`;

  const cases: Array<{ name: string; media: any; expectIncludes: string }> = [
    {
      name: 'image',
      media: { mediaType: 'image', messageId: 'img1', storageKey: 'media/t/1.jpg' },
      expectIncludes: '已收到您的圖片',
    },
    {
      name: 'audio',
      media: { mediaType: 'audio', messageId: 'aud1', storageKey: 'media/t/1.m4a' },
      expectIncludes: '已收到您的語音訊息',
    },
    {
      name: 'video',
      media: { mediaType: 'video', messageId: 'vid1', storageKey: 'media/t/1.mp4' },
      expectIncludes: '已收到您的語音訊息',
    },
    {
      name: 'file',
      media: { mediaType: 'file', messageId: 'f1', fileName: 'report.pdf', storageKey: 'media/t/1.pdf' },
      expectIncludes: 'report.pdf',
    },
  ];

  for (const c of cases) {
    const result = await pipeline.handleMessage({
      userId,
      channelId,
      text: '',
      media: c.media,
    });
    const ok = result.text.includes(c.expectIncludes);
    console.log(`[2] ${c.name}: ${ok ? 'PASS' : 'FAIL'} → ${result.text.slice(0, 60)}`);
    if (!ok) fail(`media ${c.name} reply missing "${c.expectIncludes}": ${result.text}`);
  }

  const convStore = (await import('./src/agent/stateStore.js')).getConversationStore();
  const convs = await convStore.listByUser(userId, channelId);
  if (convs.length === 0) fail('no conversation persisted for media messages');
  console.log('[3] media messages persisted to conversation OK');

  console.log('\nALL MEDIA PIPELINE CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
