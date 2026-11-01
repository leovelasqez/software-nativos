import { expect, type Page } from '@playwright/test';

export async function exerciseLoginTerminals(parent: Page, password: string) {
  const context = await parent.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:4320' });
  try {
    const page = await context.newPage();
    async function login(user: string) {
      await page.getByLabel('Usuario', { exact: true }).fill(user);
      await page.getByLabel('Contraseña', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar a caja', exact: true }).click();
    }
    async function logout() {
      await page.getByRole('button', { name: 'Salir', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Inicia sesión en caja' })).toBeVisible();
    }
    await page.goto('/caja');
    // AC-018-12: a cashier is the very first user of this empty browser context.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    await page.screenshot({ path: 'test-results/login-terminals/fresh-cashier.png', fullPage: true });
    await logout();
    await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('milan-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await logout();
    // AC-018-08/12: the owner's Milán preference does not change the cashier's branch.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.getByLabel('Sucursal', { exact: true }).locator('option')).toHaveCount(1);
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    // A separate private context enters with the same credentials and no owner's session.
    const other = await parent.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:4320' });
    try {
      const otherPage = await other.newPage();await otherPage.goto('/caja');
      await otherPage.getByLabel('Usuario', { exact: true }).fill('e2e-cashier');
      await otherPage.getByLabel('Contraseña', { exact: true }).fill(password);
      await otherPage.getByRole('button', { name: 'Entrar a caja', exact: true }).click();
      await expect(otherPage.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
      await expect(otherPage.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    } finally { await other.close(); }
    await page.screenshot({ path: 'test-results/login-terminals/cashier-centro.png', fullPage: true });
    await logout();await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('centro-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await logout();await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await logout();await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('milan-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await logout();await context.setOffline(true);
    // AC-018-11: the cashier can recover their saved Centro profile offline.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.reload();
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
  } finally { await context.close(); }
}
