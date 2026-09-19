import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { AxeBuilder } from '@axe-core/playwright';

export async function exerciseCatalog(page: Page, password: string) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const nav = async (name: string) => {
    const navigation = page.locator('.sidebar nav');
    await expect(navigation).toBeAttached();
    if (!await navigation.isVisible()) await page.getByRole('button', { name: 'Mostrar navegación' }).click();
    await navigation.getByRole('button', { name, exact: true }).click();
  };
  const dialog = page.getByRole('dialog');
  const reason = async () => dialog.getByLabel('Motivo del cambio').fill('Verificación sintética del incremento 2');
  const save = async (name: string) => { await dialog.getByRole('button', { name, exact: true }).click(); await expect(dialog).not.toBeVisible(); };
  await nav('Productos'); await page.getByRole('button', { name: '+ Nuevo producto', exact: true }).click();
  await expect(dialog.getByLabel('Nombre', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByLabel('Referencia', { exact: true })).toBeFocused();
  await dialog.getByLabel('Nombre', { exact: true }).fill('Batido de prueba'); await dialog.getByLabel('Referencia', { exact: true }).fill('E2E-BATIDO');
  await dialog.getByLabel('Tipo', { exact: true }).selectOption('prepared'); await dialog.getByLabel('Categoría').fill('Pruebas'); await dialog.getByLabel('Presentación').fill('12 onzas'); await dialog.getByLabel('Precio final (COP)').fill('12000'); await reason();
  await save('Guardar producto'); await expect(page.getByText('Sin impuesto asignado', { exact: true })).toBeVisible(); await expect(page.getByText(/Requiere receta activa/)).toBeVisible();
  await nav('Inventario'); await expect(page.getByRole('button', { name: '+ Nuevo artículo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByLabel('Usuario', { exact: true }).fill('e2e-owner'); await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: 'Entrar a Nativos' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Equipo' })).toBeVisible(); await page.getByLabel('Sucursal', { exact: true }).selectOption('centro');
  await nav('Inventario'); await page.getByRole('button', { name: '+ Nuevo artículo' }).click();
  await dialog.getByLabel('Nombre del artículo').fill('Leche de prueba'); await dialog.getByLabel('Referencia').fill('E2E-LECHE'); await dialog.getByLabel('Unidad base', { exact: true }).selectOption('ml'); await reason(); await save('Guardar registro');
  await page.getByRole('button', { name: 'Registrar inicial · Leche de prueba', exact: true }).click(); await dialog.getByLabel('Cantidad inicial').fill('2'); await dialog.getByLabel('Unidad de entrada').fill('l'); await dialog.getByLabel('Costo por ml (COP, opcional)').fill('3'); await reason(); await save('Guardar registro');
  await expect(page.getByText('2.000 ml', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mínimo · Leche de prueba', exact: true }).click(); await dialog.getByLabel('Mínimo en unidad base').fill('2500'); await reason(); await save('Guardar registro');
  await expect(page.getByText('En mínimo o por debajo', { exact: true })).toBeVisible();
  await nav('Recetas'); await page.getByLabel('Producto preparado', { exact: true }).selectOption({ label: 'Batido de prueba · 12 onzas' }); await page.getByRole('button', { name: '+ Nueva receta' }).click();
  await dialog.getByLabel('Línea 1 · Artículo', { exact: true }).selectOption({ label: 'Leche de prueba (ml)' }); await reason(); await save('Guardar receta');
  await expect(page.getByText(/VERSIÓN 1 · BORRADOR/)).toBeVisible(); await page.getByRole('button', { name: 'Crear versión desde v1', exact: true }).click();
  await dialog.getByLabel('Estado', { exact: true }).selectOption('active'); await reason(); await dialog.getByRole('button', { name: 'Guardar receta' }).click(); await expect(dialog.getByRole('alert')).toContainText('Línea 1');
  await dialog.getByLabel('Línea 1 · Cantidad', { exact: true }).fill('100'); await dialog.getByRole('button', { name: '+ Agregar opción' }).click();
  await dialog.getByLabel('Opción 1 · Nombre', { exact: true }).fill('Leche adicional'); await dialog.getByLabel('Opción 1 · Artículo', { exact: true }).selectOption({ label: 'Leche de prueba (ml)' }); await dialog.getByLabel('Opción 1 · Cantidad', { exact: true }).fill('50'); await dialog.getByLabel('Opción 1 · Precio adicional (COP)', { exact: true }).fill('1000');
  await save('Guardar receta'); await expect(page.getByText(/VERSIÓN 2 · ACTIVA VIGENTE/)).toBeVisible(); await expect(page.getByRole('status').filter({ hasText: 'Costo de receta v2' })).toContainText('300');
  await nav('Productos'); await expect(page.getByText(/Habilitado · v1/)).toBeVisible();
  await page.getByRole('button', { name: 'Editar Batido de prueba', exact: true }).click(); await dialog.getByLabel('Precio final (COP)').fill('13000'); await reason(); await save('Guardar producto'); await expect(page.getByText(/Habilitado · v2/)).toBeVisible();
  await page.reload(); await nav('Productos'); await expect(page.getByRole('heading', { name: 'Batido de prueba', exact: true })).toBeVisible();
  await mkdir('test-results/unified-web/regression/regression', { recursive: true });
  for (const viewport of [{ width: 1440, height: 1000, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
    await page.setViewportSize(viewport);
    for (const dark of [false, true]) {
      const toggle = page.getByRole('switch', { name: 'Modo oscuro' }); if ((await toggle.getAttribute('aria-checked') === 'true') !== dark) await toggle.click();
      for (const name of ['Productos', 'Recetas', 'Inventario']) {
        await nav(name);
        if (name === 'Recetas') await page.getByLabel('Producto preparado', { exact: true }).selectOption({ label: 'Batido de prueba · 12 onzas' });
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(report.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        await page.screenshot({ path: `test-results/unified-web/regression/regression/${viewport.name}-${dark ? 'dark' : 'light'}-${name.toLowerCase()}.png`, fullPage: true });
      }
    }
  }
  await nav('Productos'); await page.getByRole('button', { name: '+ Nuevo producto', exact: true }).click();
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(report.violations.map(v => v.id)).toEqual([]);
  await page.screenshot({ path: 'test-results/unified-web/regression/regression/mobile-product-form.png', fullPage: true }); await page.keyboard.press('Escape');
  await nav('Recetas'); await page.getByLabel('Producto preparado', { exact: true }).selectOption({ label: 'Batido de prueba · 12 onzas' });
  await page.getByRole('button', { name: 'Crear versión desde v2', exact: true }).click();
  await expect(dialog.getByLabel('Nombre de receta')).toBeFocused();
  const recipeReport = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(recipeReport.violations.map(v => v.id)).toEqual([]);
  await page.screenshot({ path: 'test-results/unified-web/regression/regression/mobile-recipe-form.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Guardar receta', exact: true }).scrollIntoViewIfNeeded(); await expect(dialog.getByRole('button', { name: 'Guardar receta', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await nav('Inventario'); await page.getByRole('button', { name: 'Revertir inicial', exact: true }).click(); await reason(); await save('Guardar registro');
  await expect(page.getByText('0 ml', { exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Reversión · Leche de prueba', exact: true })).toBeVisible();
}
