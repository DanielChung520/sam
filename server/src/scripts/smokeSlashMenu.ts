// Smoke test: verify slash menu builds and resolves correctly
// Run with: npx tsx src/scripts/smokeSlashMenu.ts

import { buildSlashMenu, formatSlashMenuText, resolveSlashCommand, resolveMenuChoice } from '../agent/slashMenu.js';
import { invalidateMenuCache } from '../agent/slashMenu.js';

async function main() {
  console.log('[menu-smoke] start');

  invalidateMenuCache();
  const menu = await buildSlashMenu();
  console.log(`[menu-smoke] menu size: ${menu.length}`);

  if (menu.length === 0) {
    throw new Error('menu should have at least the seeded agents');
  }

  const mainAgents = menu.filter((m) => m.type === 'main_agent');
  const subAgents = menu.filter((m) => m.type === 'sub_agent');
  const skills = menu.filter((m) => m.type === 'skill');
  console.log(`  main agents: ${mainAgents.length}, sub agents: ${subAgents.length}, skills: ${skills.length}`);

  const polaris = menu.find((m) => m.name === 'Polaris');
  if (!polaris) throw new Error('Polaris should be in menu as main_agent');
  if (polaris.type !== 'main_agent') throw new Error('Polaris type wrong');

  const rigel = menu.find((m) => m.name === 'Rigel');
  if (!rigel) throw new Error('Rigel should be in menu as sub_agent');
  if (rigel.type !== 'sub_agent') throw new Error('Rigel type wrong');

  console.log('[menu-smoke] test 1: indexes are sequential');
  for (let i = 0; i < menu.length; i++) {
    if (menu[i].index !== i + 1) {
      throw new Error(`index mismatch at position ${i}: expected ${i + 1}, got ${menu[i].index}`);
    }
  }
  console.log('  PASS');

  console.log('[menu-smoke] test 2: resolveSlashCommand exact match');
  const polarisTarget = await resolveSlashCommand('/polaris');
  if (!polarisTarget) throw new Error('should resolve /polaris');
  if (polarisTarget.name !== 'Polaris') throw new Error('resolved target wrong');
  console.log('  PASS');

  console.log('[menu-smoke] test 3: resolveSlashCommand with args');
  const siriusTarget = await resolveSlashCommand('/sirius 研究量子計算');
  if (!siriusTarget) throw new Error('should resolve /sirius');
  if (siriusTarget.remainingArgs !== '研究量子計算') {
    throw new Error(`args not passed: got "${siriusTarget.remainingArgs}"`);
  }
  console.log('  PASS');

  console.log('[menu-smoke] test 4: resolveSlashCommand partial match');
  const polTarget = await resolveSlashCommand('/pol');
  if (!polTarget) throw new Error('should resolve /pol → Polaris');
  if (polTarget.name !== 'Polaris') {
    console.log(`  (resolved to: ${polTarget.name})`);
    throw new Error('partial match should pick Polaris uniquely');
  }
  console.log('  PASS');

  console.log('[menu-smoke] test 5: resolveSlashCommand unknown');
  const unknown = await resolveSlashCommand('/zzzz');
  if (unknown !== null) throw new Error('unknown should return null');
  console.log('  PASS');

  console.log('[menu-smoke] test 6: resolveSlashCommand bare / returns null (menu display)');
  const bare = await resolveSlashCommand('/');
  if (bare !== null) throw new Error('/ alone should return null (handled by menu display)');
  console.log('  PASS');

  console.log('[menu-smoke] test 7: resolveMenuChoice');
  const idx1 = await resolveMenuChoice('1');
  if (!idx1) throw new Error('"1" should resolve');
  console.log(`  resolved to ${idx1.name}`);
  console.log('  PASS');

  console.log('[menu-smoke] test 8: formatSlashMenuText');
  const text = await formatSlashMenuText();
  if (!text.includes('可用功能')) throw new Error('menu text missing header');
  if (!text.includes('Polaris')) throw new Error('menu text missing Polaris');
  console.log(`  menu text length: ${text.length}`);
  console.log('  PASS');

  console.log('\n[menu-smoke] first 30 lines of menu:');
  console.log('---');
  console.log(text.split('\n').slice(0, 30).join('\n'));
  console.log('---');

  console.log('[menu-smoke] OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('[menu-smoke] FAILED', e);
  process.exit(1);
});