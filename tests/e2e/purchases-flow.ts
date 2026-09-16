import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// AC-003-09: the administrative purchase flow is online, scoped to the selected
// branch, and its stock effect is confirmed by the server before the dialog closes.
export async function exercisePurchases(page: Page) {
  const nav = page.locator('.sidebar nav');
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Mostrar navegación' }).click();
  await nav.getByRole('button', { name: 'Compras y proveedores', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compras y proveedores', exact: true })).toBeVisible();
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: '+ Proveedor', exact: true }).click();
  await dialog.getByLabel('Nombre').fill('Proveedor E2E');
  await dialog.getByLabel('Documento / NIT (opcional)').fill('900000001');
  await dialog.getByLabel('Motivo del cambio').fill('Proveedor sintético de compra');
  await dialog.getByRole('button', { name: 'Guardar proveedor', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '+ Registrar compra', exact: true }).click();
  await dialog.getByLabel('Proveedor').selectOption({ label: 'Proveedor E2E' });
  await dialog.getByLabel('Artículo 1').selectOption({ label: 'Leche de prueba (ml)' });
  await dialog.getByLabel('Cantidad 1').fill('2');
  await dialog.getByLabel('Precio unitario 1 (COP)').fill('7');
  await dialog.getByLabel('Importe pagado (debe coincidir con las líneas)').fill('14');
  await dialog.getByLabel('Motivo del cambio').fill('Compra sintética de verificación');
  await dialog.getByRole('button', { name: 'Registrar compra', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Proveedor E2E', { exact: true })).toBeVisible();
  await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: 'Proveedor E2E', exact: true }) })).toContainText('14');
}
