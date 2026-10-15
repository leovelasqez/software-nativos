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
    await login('e2e-owner');
    await page.getByLabel('Equipo').selectOption('milan-caja');
    await page.getByRole('button', { name: 'Activar caja', exact: true }).click();
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await logout();
    // AC-018-08/09: only Milán was activated, but Centro is this user's branch.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.getByLabel('Sucursal', { exact: true }).locator('option')).toHaveCount(1);
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
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
