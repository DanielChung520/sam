// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Admin Panel - Channels & Agents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:7012/login', { waitUntil: 'networkidle', timeout: 45000 });
    // Wait for React to mount by waiting for the first input to appear
    await page.waitForSelector('#root input, input[placeholder]', { timeout: 30000 });
    const inputs = page.locator('input');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill('admin');
      await inputs.nth(1).fill('admin123');
    }
    await page.locator('button').filter({ hasText: 'Sign In' }).click();
    await page.waitForURL('http://localhost:7012/', { timeout: 30000 });
  });

  test('Channels page renders with correct title', async ({ page }) => {
    await page.goto('http://localhost:7012/channels', { waitUntil: 'networkidle' });
    await expect(page.locator('.page-title')).toHaveText('Channel Management');
  });

  test('Skills page is reachable from sidebar', async ({ page }) => {
    await page.goto('http://localhost:7012/', { waitUntil: 'networkidle' });
    const sidebar = page.locator('nav');
    await expect(sidebar).toContainText('Skills');
    await page.goto('http://localhost:7012/skills', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL('http://localhost:7012/skills');
  });

  test('Agent Center page renders with tabs and cards', async ({ page }) => {
    await page.goto('http://localhost:7012/agent-center', { waitUntil: 'networkidle' });
    await expect(page.locator('.page-title')).toHaveText('Agent Center');
    // Tabs
    await expect(page.locator('.tab').filter({ hasText: '全部' })).toBeVisible();
    await expect(page.locator('.tab').filter({ hasText: '主 Agent' })).toBeVisible();
    await expect(page.locator('.tab').filter({ hasText: 'Sub-Agent' })).toBeVisible();
    // At least one card (test agents were seeded via curl)
    const cards = page.locator('.card').filter({ hasText: '主 Agent' });
    await expect(cards.first()).toBeVisible();
  });

  test('Seeded default agents (Polaris/Rigel etc) visible with category badges', async ({ page }) => {
    await page.goto('http://localhost:7012/agent-center', { waitUntil: 'networkidle' });
    // Polaris card: filter by unique text '對話編排' (its template) to avoid Vega card match
    const polarisCard = page.locator('.card').filter({ hasText: '對話編排' });
    await expect(polarisCard).toBeVisible();
    await expect(polarisCard.first()).toContainText('Polaris');
    await expect(polarisCard.first()).toContainText('編排');
    // Sirius (planner) — by template '任務規劃'
    const siriusCard = page.locator('.card').filter({ hasText: '任務規劃' });
    await expect(siriusCard).toBeVisible();
    await expect(siriusCard.first()).toContainText('Sirius');
    // Rigel (worker) — by template '資料蒐集'
    const rigelCard = page.locator('.card').filter({ hasText: '資料蒐集' });
    await expect(rigelCard).toBeVisible();
    await expect(rigelCard.first()).toContainText('Rigel');
  });

  test('Persona tab in AgentDetail shows template + role + traits', async ({ page }) => {
    await page.goto('http://localhost:7012/agent-center', { waitUntil: 'networkidle' });
    // Click Polaris card via its unique template text
    await page.locator('.card').filter({ hasText: '對話編排' }).first().click();
    // Persona tab is default; should show '對話編排' template in modal
    await expect(page.locator('.modal').filter({ hasText: '對話編排' })).toBeVisible();
    // Click '設定' tab
    await page.locator('.modal button').filter({ hasText: '設定' }).click();
    await expect(page.locator('.modal input').first()).toBeVisible();
    // Close
    await page.locator('.modal-close').click();
  });

  test('AgentDetail shows 5 tabs (Persona/設定/意圖/Rate/Raw) and intent rules table', async ({ page }) => {
    await page.goto('http://localhost:7012/agent-center', { waitUntil: 'networkidle' });
    await page.locator('.card').filter({ hasText: '對話編排' }).first().click();
    // 5 tabs, no legacy /指令 / 路由 / Channels tabs
    const modal = page.locator('.modal');
    await expect(modal.locator('button').filter({ hasText: 'Persona' })).toBeVisible();
    await expect(modal.locator('button').filter({ hasText: '設定' })).toBeVisible();
    await expect(modal.locator('button').filter({ hasText: '意圖' })).toBeVisible();
    await expect(modal.locator('button').filter({ hasText: 'Rate' })).toBeVisible();
    await expect(modal.locator('button').filter({ hasText: 'Raw' })).toBeVisible();
    await expect(modal.locator('button').filter({ hasText: '/ 指令' })).toHaveCount(0);
    await expect(modal.locator('button').filter({ hasText: '路由' })).toHaveCount(0);
    // Intent tab shows rules table
    await modal.locator('button').filter({ hasText: '意圖' }).click();
    await expect(modal.locator('button').filter({ hasText: '＋ 新增意圖規則' })).toBeVisible();
    // Intent params moved to 設定 tab
    await modal.locator('button').filter({ hasText: '設定' }).click();
    await expect(modal.locator('label').filter({ hasText: '意圖分類信心門檻' })).toBeVisible();
    await modal.locator('.modal-close').click();
  });

  test('Sidebar has Agent Center not legacy Agent/Sub-Agents', async ({ page }) => {
    await page.goto('http://localhost:7012/', { waitUntil: 'networkidle' });
    const sidebar = page.locator('nav');
    await expect(sidebar).toContainText('Agent Center');
    await expect(sidebar).not.toContainText('Sub-Agents');
  });

  test('Accounts page renders without role column', async ({ page }) => {
    await page.goto('http://localhost:7012/accounts', { waitUntil: 'networkidle' });
    await expect(page.locator('.page-title')).toHaveText('Accounts');
    // Verify no "Role" column heading
    const headers = page.locator('th');
    const headerCount = await headers.count();
    let hasRole = false;
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text === 'Role') hasRole = true;
    }
    expect(hasRole).toBe(false);
  });

  test('Sidebar no longer shows Roles', async ({ page }) => {
    await page.goto('http://localhost:7012/', { waitUntil: 'networkidle' });
    const sidebar = page.locator('nav');
    await expect(sidebar).not.toContainText('Roles');
    await expect(sidebar).toContainText('Channels');
    await expect(sidebar).toContainText('Agent');
  });

  test('BusinessDocs page renders + sidebar entry', async ({ page }) => {
    await page.goto('http://localhost:7012/business-docs', { waitUntil: 'networkidle' });
    await expect(page.locator('.page-title')).toHaveText('Business Knowledge Base');
    const sidebar = page.locator('nav');
    await expect(sidebar).toContainText('Knowledge');
    // Channel input visible
    await expect(page.locator('input[placeholder="Channel ID"]')).toBeVisible();
  });

  test('No console errors on all updated pages', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('http://localhost:7012/channels', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.goto('http://localhost:7012/agent', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.goto('http://localhost:7012/accounts', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });
});
