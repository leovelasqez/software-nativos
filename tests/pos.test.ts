import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { calculateSale } from '../src/pos-domain.ts';
import type { Snapshot } from '../src/pos-domain.ts';
import { signAuthorization, verifyAuthorization } from '../src/pos-crypto.ts';
import { defaultActions } from '../src/authorization.ts';
import { WEEK_MS } from '../src/contracts.ts';
const snapshot: Snapshot = { id: 'snapshot', createdAtMs: 1, branchId: 'centro', deviceId: 'caja', warehouseId: 'bodega', serverSequence: 0, stock: [], recipes: [], products: [{ id: 'producto', name: 'Sintético', type: 'finished', reference: 'TEST', category: 'Test', presentation: 'Unidad', unit: 'unit', price: '100.5', tax: null, description: '', version: 1, activeRecipeVersion: null, sellable: true }] };
const lines = [{ id: 'line', productId: 'producto', snapshotId: 'snapshot', quantity: '1', optionIds: [] }];
test('Venta: precisión, redondeo al peso y excedente solo en efectivo', () => {
  const sale = calculateSale(snapshot, lines, { method: 'cash', received: '200' });
  assert.equal(sale.total, '101'); assert.equal(sale.rounding, '0.5'); assert.equal(sale.change, '99'); assert.equal(sale.cashApplied, '101'); assert.equal(sale.lines[0]!.taxAmount, null);
  assert.deepEqual(sale.consumption, [{ itemId: 'producto', quantity: '1' }]);
  assert.throws(() => calculateSale(snapshot, lines, { method: 'cash', received: '100' }));
  assert.throws(() => calculateSale(snapshot, lines, { method: 'nequi', received: '200' }));
  assert.equal(calculateSale(snapshot, lines, { method: 'nequi', received: '101' }).cashApplied, '0');
  assert.throws(() => calculateSale(snapshot, [{ ...lines[0]!, quantity: '0' }]));
});
test('Venta: precio e impuesto históricos por línea; cero distinto de no asignado', () => {
  const next = structuredClone(snapshot); next.id = 'next'; next.products[0]!.price = '119'; next.products[0]!.tax = { label: 'Tasa sintética', rate: '19', exempt: false };
  const sale = calculateSale(next, [...lines, { ...lines[0]!, id: 'second', snapshotId: 'next' }], undefined, [snapshot, next]);
  assert.equal(sale.total, '220'); assert.equal(sale.lines[0]!.unitPrice, '100.5'); assert.equal(sale.lines[1]!.taxAmount, '19');
  next.products[0]!.tax!.rate = '0'; assert.equal(calculateSale(next, [{ ...lines[0]!, snapshotId: 'next' }]).lines[0]!.taxAmount, '0');
  assert.throws(() => calculateSale(next, lines));
});
test('Concesión: firma Ed25519 detecta permisos alterados y otra clave', () => {
  const pair = generateKeyPairSync('ed25519'); const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(); const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const signed = signAuthorization({ actorName: 'Prueba', principal: { version: 1, actorId: 'actor', kind: 'human', active: true, role: 'cashier', branchIds: ['centro'], actions: defaultActions('cashier') }, grant: { version: 1, grantId: 'grant', actorId: 'actor', branchId: 'centro', deviceId: 'caja', validatedAtMs: 100, expiresAtMs: 100 + WEEK_MS, actions: ['data.read', 'sale.charge'] } }, privateKey);
  assert.equal(verifyAuthorization(signed, publicKey).actorName, 'Prueba');
  assert.throws(() => verifyAuthorization({ ...signed, document: signed.document.replace('Prueba', 'Alterado') }, publicKey));
  assert.throws(() => verifyAuthorization(signed, generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()));
});
