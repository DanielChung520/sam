// Seed default agents to ArangoDB
//
// Run with: npx tsx src/scripts/seedDefaultAgents.ts
// Idempotent — only inserts missing agents (by _key), updates existing.

import { upsertAgent } from '../data/agentRepo.js';
import { DEFAULT_MAIN_AGENTS } from '../data/defaultMainAgents.js';
import { DEFAULT_SUB_AGENTS } from '../data/defaultSubAgents.js';

async function main() {
  console.log('[seed] Starting...');

  console.log(`[seed] ${DEFAULT_MAIN_AGENTS.length} main agents + ${DEFAULT_SUB_AGENTS.length} sub agents`);

  let inserted = 0;
  let updated = 0;

  for (const a of [...DEFAULT_MAIN_AGENTS, ...DEFAULT_SUB_AGENTS]) {
    try {
      // Check if exists by attempting upsert (upsertAgent handles both insert and update)
      await upsertAgent(a);
      // Since we don't know if it was inserted vs updated without separate check,
      // we'll just log per-agent success
      console.log(`[seed] ${a._key} (${a.category}) — OK`);
      inserted++; // upsert doesn't tell us, just count as processed
    } catch (e) {
      console.error(`[seed] ${a._key} failed:`, e);
    }
  }

  console.log(`[seed] Done. Processed: ${inserted + updated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed] Fatal:', e);
  process.exit(1);
});