const { test, expect } = require('@playwright/test');

test('Add Channel modal: fields empty + Create works with account', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:7012/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#root input, input[placeholder]', { timeout: 30000 });
  const inputs = page.locator('input');
  const count = await inputs.count();
  if (count >= 2) {
    await inputs.nth(0).fill('admin');
    await inputs.nth(1).fill('admin123');
  }
  await page.locator('button').filter({ hasText: 'Sign In' }).click();
  await page.waitForURL('http://localhost:7012/', { timeout: 30000 });

  await page.goto('http://localhost:7012/channels', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button').filter({ hasText: 'Add Channel' }).first().click();
  await page.waitForSelector('.modal', { timeout: 10000 });
  await page.waitForTimeout(300);

  const modal = page.locator('.modal');
  const fieldCount = await modal.locator('input').count();
  let allEmpty = true;
  for (let i = 0; i < fieldCount; i++) {
    const v = await modal.locator('input').nth(i).inputValue();
    if (v !== '') allEmpty = false;
  }
  console.log(`欄位全空: ${allEmpty}（${fieldCount} 個 input）`);

  const accountSel = modal.locator('select').nth(1);
  const optCount = await accountSel.locator('option').count();
  console.log(`所屬帳號選項數: ${optCount}`);
  if (optCount > 1) {
    await accountSel.selectOption({ index: 1 });
    await modal.locator('input').nth(0).fill('e2e-clean-' + Date.now());
    await modal.locator('input').nth(1).fill('L' + Date.now());
    const createBtn = page.locator('button').filter({ hasText: 'Create' });
    const isEnabled = await createBtn.isEnabled();
    console.log(`Create 按鈕 enabled（選帳號後）: ${isEnabled}`);
    await createBtn.click();
    await page.waitForTimeout(3000);
    const modalClosed = !(await modal.isVisible().catch(() => false));
    console.log(`Create 後 modal 關閉: ${modalClosed}`);
    expect(allEmpty).toBe(true);
    expect(isEnabled).toBe(true);
    expect(modalClosed).toBe(true);
  } else {
    console.log('WARN: 無帳號可選 — 檢查 accounts API');
  }
  console.log(`console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  expect(errors.length).toBe(0);
});
