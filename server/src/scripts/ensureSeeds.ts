// Startup seeds — 啟動時確保基礎資料存在（idempotent）
//
// 1. Admin business account（平台第一個帳號）
// 2. 預設 Agents（Polaris/Sirius/...）— 從 defaultMain/SubAgents

import { upsertAccount, findAccountById } from '../data/accountRepo.js';
import { upsertAgent, findAgentById } from '../data/agentRepo.js';
import { DEFAULT_MAIN_AGENTS } from '../data/defaultMainAgents.js';
import { DEFAULT_SUB_AGENTS } from '../data/defaultSubAgents.js';
import { hashPassword } from '../data/accountRepo.js';
import { logger } from '../agent/logger.js';

export const ADMIN_ACCOUNT_KEY = 'admin';

export async function ensureSeeds(): Promise<void> {
  // 1. Admin account
  const existing = await findAccountById(ADMIN_ACCOUNT_KEY).catch(() => null);
  if (!existing) {
    await upsertAccount({
      _key: ADMIN_ACCOUNT_KEY,
      name: '平台管理員',
      email: 'admin@sam.local',
      username: 'admin',
      passwordHash: hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'admin123'),
      businessOwnerId: ADMIN_ACCOUNT_KEY,
      channelIds: [],
      enabled: true,
      source: 'admin',
    });
    logger.info('seed.admin_account.created', { key: ADMIN_ACCOUNT_KEY });
  }

  // 2. Default agents
  let agentInserted = 0;
  for (const a of [...DEFAULT_MAIN_AGENTS, ...DEFAULT_SUB_AGENTS]) {
    const exists = await findAgentById(a._key).catch(() => null);
    if (!exists) {
      await upsertAgent(a);
      agentInserted++;
    }
  }
  if (agentInserted > 0) {
    logger.info('seed.agents.inserted', { count: agentInserted });
  }
}
