import { expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function adminNavigation(page: Page, name: string) {
  if (await page.getByRole('button', { name: 'Mostrar navegación' }).isVisible()) await page.getByRole('button', { name: 'Mostrar navegación' }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
export async function seedSeller(page: Page) {
  await adminNavigation(page, 'Vendedores');
  await page.getByRole('button', { name: '+ Nuevo vendedor', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del vendedor').fill('Vendedor de prueba');
  await dialog.getByLabel('Centro', { exact: true }).check(); await dialog.getByLabel('Milán', { exact: true }).check();
  await dialog.getByLabel('Motivo del cambio').fill('Vendedor sintético de regresión');
  await dialog.getByRole('button', { name: 'Crear vendedor', exact: true }).click(); await expect(dialog).not.toBeVisible();
}

export async function exerciseSellers(parent: Page, password: string) {
  const context = await parent.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:4320', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
  await page.goto('/');
  await page.getByLabel('Usuario', { exact: true }).fill('e2e-owner'); await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar a Nativos', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Hola, Equipo' })).toBeVisible();
  await adminNavigation(page, 'Vendedores'); await page.getByRole('button', { name: '+ Nuevo vendedor', exact: true }).click();
  let dialog = page.getByRole('dialog'); await dialog.getByLabel('Nombre del vendedor').fill('Ana de ventas E2E');
  await dialog.getByLabel('Milán', { exact: true }).check(); await dialog.getByLabel('Motivo del cambio').fill('Prueba de vendedores bajo una cuenta');
  await dialog.getByRole('button', { name: 'Crear vendedor', exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByLabel('Buscar producto', { exact: true }).fill('Batido de prueba');
  await mkdir('test-results/sellers', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const dark of [false, true]) {
      const toggle = page.getByRole('switch', { name: 'Modo oscuro' });
      if ((await toggle.getAttribute('aria-checked')) !== String(dark)) await toggle.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations.map(v => v.id)).toEqual([]);
      await page.screenshot({ path: `test-results/sellers/admin-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Configurar comisión de Batido de prueba', exact: true }).click();
  await dialog.getByLabel('Comisión por unidad (COP)').fill('1000'); await dialog.getByLabel('Motivo del cambio').fill('Comisión sintética por unidad');
  await dialog.getByRole('button', { name: 'Guardar comisión', exact: true }).click(); await expect(dialog).not.toBeVisible();
  const sellers = await page.evaluate(async () => (await (await fetch('/api/sellers?branchId=milan')).json()).items as { id: string; name: string }[]);
  const ana = sellers.find(s => s.name === 'Ana de ventas E2E')!.id, other = sellers.find(s => s.name === 'Vendedor de prueba')!.id;
  await mkdir('test-results/sellers', { recursive: true });
  await page.goto('/caja');
  await expect(page.getByRole('heading', { name: 'Activa esta caja', exact: true }).or(page.getByLabel('Sucursal', { exact: true }))).toBeVisible();
  if (await page.getByRole('heading', { name: 'Activa esta caja', exact: true }).isVisible()) {
    await page.getByLabel('Equipo', { exact: true }).selectOption('milan-caja');
    const input = page.getByLabel('Contraseña para habilitar Caja sin conexión'); if (await input.isVisible()) await input.fill(password);
    await page.getByRole('button', { name: 'Activar caja', exact: true }).click();
  }
  await expect(page.getByLabel('Sucursal', { exact: true })).toBeVisible();
  if (await page.getByLabel('Sucursal', { exact: true }).inputValue() !== 'milan-caja') await page.getByLabel('Sucursal', { exact: true }).selectOption('milan-caja');
  await page.getByRole('navigation').getByRole('button', { name: 'Turno', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir turno', exact: true }).click(); await page.getByLabel('Base de efectivo (COP)').fill('0');
  await page.getByRole('button', { name: 'Confirmar apertura' }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Sincronizar', exact: true }).click(); await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  await page.getByRole('navigation').getByRole('button', { name: 'Venta', exact: true }).click();
  const add = async () => {
    await page.getByRole('button').filter({ hasText: 'Batido de prueba' }).click();
    await dialog.getByLabel('Tipo de descuento', { exact: true }).selectOption('percent');
    await dialog.getByLabel('Descuento', { exact: true }).fill('10');
    await dialog.getByRole('button', { name: 'Guardar en pedido' }).click(); await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'Cobrar pedido', exact: true }).click();
  };
  await add(); await expect(dialog.getByRole('button', { name: 'Confirmar cobro' })).toBeDisabled();
  await dialog.getByLabel('Vendedor', { exact: true }).selectOption(ana);
  await dialog.getByLabel('Propina voluntaria').fill('1000'); await dialog.getByRole('button', { name: 'Importe exacto', exact: true }).click();
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const dark of [false, true]) {
      // Theme preference is shared by the real UI and must survive the modal.
      await page.evaluate(value => { document.documentElement.dataset.theme = value; localStorage.setItem('nativos-theme', value); }, dark ? 'dark' : 'light');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: `test-results/sellers/checkout-${viewport.name}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel('Vendedor', { exact: true }).focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
  await page.context().setOffline(true); await dialog.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(dialog.getByRole('heading', { name: 'Comprobante interno', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Ana de ventas E2E'); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await page.reload(); await add(); await expect(dialog.getByLabel('Vendedor', { exact: true })).toHaveValue(ana);
  await dialog.getByLabel('Vendedor', { exact: true }).selectOption(other); await dialog.getByLabel('Propina voluntaria').fill('2000');
  await dialog.getByRole('button', { name: 'Importe exacto', exact: true }).click(); await dialog.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(dialog.getByRole('heading', { name: 'Comprobante interno', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Vendedor de prueba'); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await page.reload();
  await add(); await expect(dialog.getByLabel('Vendedor', { exact: true })).toHaveValue(other); await page.keyboard.press('Escape');
  let lost = false;
  await page.route('**/api/pos/sync', async route => {
    const body = route.request().postDataJSON() as { payload: string };
    if (!lost && JSON.parse(body.payload).sellerId === ana) { const response = await route.fetch(); expect(response.status()).toBe(200); lost = true; await route.abort(); }
    else await route.continue();
  });
  await page.context().setOffline(false); await page.getByRole('button', { name: 'Sincronizar', exact: true }).click();
  await expect.poll(() => lost).toBeTruthy(); await page.unroute('**/api/pos/sync');
  await page.getByRole('button', { name: 'Sincronizar', exact: true }).click(); await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  // Keep this synthetic terminal ready for the subsequent access regression.
  await page.getByRole('navigation').getByRole('button', { name: 'Turno', exact: true }).click();
  const expected = (await page.locator('.pos-shift').getByText('Efectivo esperado:', { exact: false }).innerText()).replace(/[^0-9]/g, '');
  await page.getByRole('button', { name: 'Cerrar turno', exact: true }).click(); await page.getByLabel('Efectivo contado (COP)').fill(expected);
  await page.getByRole('button', { name: 'Confirmar cierre', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Comprobante de cierre', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar formulario', exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Sincronizar', exact: true }).click(); await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  await page.goto('/'); await page.getByLabel('Sucursal', { exact: true }).selectOption('milan'); await adminNavigation(page, 'Informes');
  await page.getByRole('combobox', { name: 'Informe', exact: true }).selectOption('sellers'); await page.getByLabel('Vendedor del informe').selectOption(ana);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  const row = page.getByRole('region', { name: 'Resultados del informe' }); await expect(row).toContainText('Ana de ventas E2E');
  await expect(row).toContainText('900'); await expect(row).toContainText('1.000');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar Excel' }).click(); expect((await download).suggestedFilename()).toBe('nativos-sellers.xlsx');
  await page.screenshot({ path: 'test-results/sellers/report.png', fullPage: true });
  const sales = await page.evaluate(async id => (await (await fetch(`/api/reports/sales?branchId=milan&sellerId=${id}`)).json()).items as { commissionAmount: string; sellerName: string }[], ana);
  expect(sales).toHaveLength(1); expect(sales[0]!.commissionAmount).toBe('900');
  await adminNavigation(page, 'Vendedores'); await page.getByRole('button', { name: 'Editar vendedor Ana de ventas E2E', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByLabel('Vendedor activo').uncheck(); await dialog.getByLabel('Motivo del cambio').fill('Fin de prueba sintética');
  await dialog.getByRole('button', { name: 'Guardar vendedor' }).click(); await expect(dialog).not.toBeVisible();
  } finally { await context.close(); }
}
