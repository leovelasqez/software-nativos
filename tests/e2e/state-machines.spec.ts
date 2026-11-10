import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startLocalPostgres, freePort } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { excelFixture } from '../excel-fixture.ts';

test('AC-021-02/03 — formulario único, importación confirmada y recuperación de consulta', async ({ page }) => {
  test.setTimeout(240_000);
  const db = await startLocalPostgres(resolve('.local/state-machines-browser-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const app = await createApp({ pool: db.pool, origin, staticRoot: resolve('dist') });
  const password = randomBytes(24).toString('base64url');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let release = () => {};
  try {
    await migrate(db.pool); await app.listen({ port, host: '127.0.0.1' });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin);
    await page.getByLabel('Nombre completo').fill('Dueño estados'); await page.getByLabel('Usuario', { exact: true }).fill('states-owner');
    await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: 'Crear mi acceso' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Dueño' })).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Usuarios y roles', exact: true }).click();
    await page.getByRole('button', { name: '+ Nuevo usuario', exact: true }).click();
    const dialog = page.getByRole('dialog'); const form = dialog.locator('form');
    await dialog.getByLabel('Nombre completo').fill('Cajero estados'); await dialog.getByLabel('Usuario de acceso').fill('states-cashier');
    await dialog.getByLabel('Contraseña', { exact: true }).fill(password); await dialog.getByLabel('Centro', { exact: true }).check();
    await dialog.getByLabel('Motivo del cambio').fill('Alta sintética de estados');
    let requests = 0;
    const gate = new Promise<void>(resolveGate => { release = resolveGate; });
    await page.route('**/api/users', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      requests++;
      if (requests === 1) { await route.fulfill({ status: 503, json: { message: 'Fallo sintético recuperable' } }); return; }
      await gate; await route.continue();
    });
    await dialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Fallo sintético recuperable');
    await expect(dialog.getByLabel('Nombre completo')).toHaveValue('Cajero estados');
    await form.evaluate(element => {
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => requests).toBe(2);
    await expect(form).toHaveAttribute('aria-busy', 'true');
    await expect(dialog.getByLabel('Nombre completo')).toBeDisabled();
    // Repeated events after React renders must also stay excluded.
    await form.dispatchEvent('submit'); expect(requests).toBe(2);
    release(); await expect(dialog).not.toBeVisible();
    expect((await db.pool.query("SELECT count(*) FROM app_users WHERE login='states-cashier'")).rows[0].count).toBe('1');
    await page.unroute('**/api/users');

    await page.getByRole('navigation').getByRole('button', { name: 'Productos', exact: true }).click();
    await page.getByRole('button', { name: 'Importar Excel', exact: true }).click();
    await dialog.getByLabel('Archivo Excel (.xlsx, máximo 5 MB)').setInputFiles({ name: 'sintetico.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await excelFixture() });
    await dialog.getByLabel('Motivo de la importación').fill('Importación sintética de estados');
    await dialog.getByRole('button', { name: 'Validar archivo', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Confirmar importación', exact: true })).toBeVisible();
    await dialog.getByLabel('Motivo de la importación').fill('Motivo sintético actualizado');
    await expect(dialog.getByRole('button', { name: 'Confirmar importación', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Validar archivo', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Confirmar importación', exact: true })).toBeVisible();
    let confirmations = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/catalog/imports/confirm') confirmations++; });
    let failRefresh = true;
    await page.route('**/api/products?*', async route => {
      if (failRefresh) { await route.fulfill({ status: 503, json: { message: 'Lista temporalmente no disponible' } }); return; }
      await route.continue();
    });
    await dialog.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
    await expect(dialog.getByRole('status').filter({ hasText: 'Importación completada' })).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('El lote ya quedó guardado');
    await expect(dialog.getByRole('button', { name: 'Confirmar importación', exact: true })).toHaveCount(0);
    expect(confirmations).toBe(1);
    expect((await db.pool.query('SELECT count(*) FROM catalog_products')).rows[0].count).toBe('2');
    const operation = await dialog.getByText(/^Operación:/).textContent();
    await mkdir('test-results/state-machines', { recursive: true });
    for (const viewport of [{ width: 1440, height: 1000, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/state-machines/${viewport.name}-${theme}.png`, fullPage: true });
      }
    }
    failRefresh = false;
    await dialog.getByRole('button', { name: 'Actualizar catálogo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByText(/^Operación:/)).toHaveText(operation!);
    await expect(page.getByRole('heading', { name: 'Botella sintética', exact: true })).toBeVisible();
    expect(confirmations).toBe(1);
    expect((await db.pool.query("SELECT count(*) FROM audit_events WHERE action='catalog.excel_imported'")).rows[0].count).toBe('1');
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Importar Excel', exact: true })).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });

    // A checkout without a seller disables SaveForm, including its submit handler.
    await page.goto(origin + '/caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir turno', exact: true }).click();
    await dialog.getByLabel('Base de efectivo (COP)').fill('10000'); await dialog.getByRole('button', { name: 'Confirmar apertura', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button').filter({ hasText: 'Botella sintética' }).click();
    await dialog.getByRole('button', { name: 'Guardar en pedido', exact: true }).click(); await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'Cobrar pedido', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Confirmar cobro', exact: true })).toBeDisabled();
    const busyChanges = await dialog.locator('form').evaluate(async element => {
      const changes: (string | null)[] = [];
      const observer = new MutationObserver(records => { changes.push(...records.map(record => record.oldValue)); });
      observer.observe(element, { attributes: true, attributeFilter: ['aria-busy'], attributeOldValue: true });
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolveWait => setTimeout(resolveWait, 100)); observer.disconnect();
      return changes;
    });
    expect(busyChanges).toEqual([]);
    await expect(dialog.locator('form')).toHaveAttribute('aria-busy', 'false');
    expect((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count).toBe('0');
    expect(errors).toEqual([]);
  } finally {
    release(); await app.close(); await db.stop();
  }
});
