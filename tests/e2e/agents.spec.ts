import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { startLocalPostgres, freePort } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';

test('AC-010-07 — dueño administra conexiones, temas/móvil y cajero sin acceso', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const db = await startLocalPostgres(resolve('.local/agents-browser-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const app = await createApp({ pool: db.pool, origin, staticRoot: resolve('dist') });
  const password = randomBytes(24).toString('base64url');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const output = 'docs/evidence/agent-connections-2026-10-15';
  try {
    await migrate(db.pool); await app.listen({ port, host: '127.0.0.1' });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin);
    await page.getByLabel('Nombre completo').fill('Dueño conexiones'); await page.getByLabel('Usuario', { exact: true }).fill('agents-browser-owner');
    await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: 'Crear mi acceso' }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Agentes de IA', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agentes de IA', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '+ Nueva conexión', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre de la conexión').fill('Codex consulta sintética'); await dialog.getByLabel('Centro', { exact: true }).check();
    await dialog.getByLabel('Motivo del cambio').fill('Prueba sintética de conexión'); await dialog.getByRole('button', { name: 'Crear conexión', exact: true }).click();
    dialog = page.getByRole('dialog'); await expect(dialog.getByRole('heading', { name: 'Guarda tu credencial' })).toBeVisible();
    const original = await dialog.getByLabel('Credencial nueva').inputValue();
    await dialog.getByRole('button', { name: 'Ya la guardé' }).click();
    await expect(page.getByRole('cell', { name: 'Codex consulta sintética', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Solo lectura', exact: true })).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(storage.includes(original)).toBe(false);
    expect((await page.request.get(origin + '/api/agent/v1/me', { headers: { Authorization: `Bearer ${original}` } })).status()).toBe(200);
    await page.getByRole('button', { name: 'Renovar Codex consulta sintética', exact: true }).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('Motivo del cambio').fill('Renovación sintética'); await dialog.getByRole('button', { name: 'Confirmar renovación' }).click();
    await expect(page.getByRole('heading', { name: 'Guarda tu credencial' })).toBeVisible();
    const replacement = await page.getByLabel('Credencial nueva').inputValue(); expect(replacement === original).toBe(false);
    await page.getByRole('button', { name: 'Ya la guardé' }).click();
    expect((await page.request.get(origin + '/api/agent/v1/me', { headers: { Authorization: `Bearer ${original}` } })).status()).toBe(401);
    await page.getByRole('button', { name: 'Revocar Codex consulta sintética', exact: true }).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('Motivo del cambio').fill('Fin de verificación sintética'); await dialog.getByRole('button', { name: 'Confirmar revocación' }).click();
    await expect(page.getByRole('cell', { name: 'Revocada', exact: true })).toBeVisible();
    expect((await page.request.get(origin + '/api/agent/v1/me', { headers: { Authorization: `Bearer ${replacement}` } })).status()).toBe(401);
    await page.getByText('Configuración para Codex', { exact: true }).click(); await page.getByText('Configuración para Claude Code', { exact: true }).click();
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const dark of [false, true]) {
        const toggle = page.getByRole('switch', { name: 'Modo oscuro' });
        if ((await toggle.getAttribute('aria-checked')) !== String(dark)) await toggle.click();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: `${output}/${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: '+ Nueva conexión', exact: true }).click(); await expect(page.getByLabel('Nombre de la conexión')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
    const cashier = await page.request.post(origin + '/api/users', { headers: { 'X-Nativos-Request': '1' }, data: { name: 'Cajero sin agentes', login: 'agents-browser-cashier', password, role: 'cashier', branchIds: ['centro'], reason: 'Prueba de visibilidad' } });
    expect(cashier.status()).toBe(201);
    const cashierContext = await browser.newContext();
    try {
      const cashierPage = await cashierContext.newPage(); await cashierPage.goto(origin);
      await cashierPage.getByLabel('Usuario', { exact: true }).fill('agents-browser-cashier'); await cashierPage.getByLabel('Contraseña', { exact: true }).fill(password);
      await cashierPage.getByRole('button', { name: 'Entrar a Nativos', exact: true }).click(); await expect(cashierPage.getByRole('heading', { name: 'Hola, Cajero' })).toBeVisible();
      await expect(cashierPage.getByRole('navigation').getByRole('button', { name: 'Agentes de IA', exact: true })).toHaveCount(0);
      expect((await cashierPage.request.get(origin + '/api/agents')).status()).toBe(403);
    } finally { await cashierContext.close(); }
    expect(errors).toEqual([]);
  } finally { await app.close(); await db.stop(); }
});
