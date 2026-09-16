import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal, formatted, multiply, toBase, freezeRecipe, consumption, recipeCost } from '../src/catalog.ts';
import type { Item, Recipe } from '../src/catalog.ts';
const items = new Map<string, Item>(['milk', 'oat', 'fruit', 'cup'].map(id => [id, { id, name: id, reference: id, kind: id === 'cup' ? 'consumable' : 'raw', baseUnit: id === 'cup' ? 'unit' : 'ml' }]));
const recipe: Recipe = { id: 'recipe', productId: 'smoothie', version: 1, name: 'Prueba', state: 'active', instructions: '',
  lines: [{ id: 'milk-line', itemId: 'milk', quantity: '100', unit: 'ml', conversion: null, kind: 'ingredient' }, { id: 'cup-line', itemId: 'cup', quantity: '1', unit: 'unit', conversion: null, kind: 'packaging' }],
  options: [{ id: 'oat-option', name: 'Avena', kind: 'substitution', replacesLineId: 'milk-line', price: '500', line: { id: 'oat-line', itemId: 'oat', quantity: '100', unit: 'ml', conversion: null, kind: 'ingredient' } }, { id: 'extra', name: 'Fruta', kind: 'addition', replacesLineId: null, price: '1000', line: { id: 'fruit-line', itemId: 'fruit', quantity: '10', unit: 'ml', conversion: null, kind: 'ingredient' } }] };
test('AC-003-01: decimales exactos y conversiones documentadas, sin densidad inferida', () => {
  assert.equal(formatted(decimal('0.1') + decimal('0.2')), '0.3');
  assert.equal(toBase('1', 'kg', 'g', null), '1000');
  assert.equal(toBase('2', 'bolsa', 'g', { factor: '250', source: 'Etiqueta validada' }), '500');
  assert.throws(() => toBase('1', 'g', 'ml', null), /conversión/);
  assert.throws(() => toBase('1', 'kg', 'g', { factor: '500', source: 'Incorrecta' }), /contradice/);
  assert.throws(() => multiply('0.000001', '0.1'), /seis decimales/);
  assert.throws(() => decimal('-1')); assert.throws(() => decimal('NaN'));
});
test('AC-002-02/07: borrador admite pendientes; activación identifica línea incompleta', () => {
  const invalid = structuredClone(recipe); invalid.lines[0]!.unit = 'gotas';
  assert.throws(() => freezeRecipe(invalid, items), /Línea 1.*conversión/);
  invalid.state = 'draft'; assert.equal(freezeRecipe(invalid, items).lines[0]!.baseQuantity, null);
  invalid.lines[0]!.conversion = { factor: '0.05', source: '' };
  assert.deepEqual(freezeRecipe(invalid, items).lines[0]!.conversion, { factor: '0.05', source: '' }, 'Conservar conversión parcial sin inventar datos');
  assert.throws(() => freezeRecipe({ ...invalid, state: 'active' }, items), /conversión/);
  invalid.state = 'active'; invalid.lines[0]!.quantity = null;
  assert.throws(() => freezeRecipe(invalid, items), /cantidad/);
  const empty = { ...recipe, lines: [], options: [] }; assert.throws(() => freezeRecipe(empty, items), /ingrediente/);
});
test('AC-002-07: receta completa exige precio de opciones y sustitución única por línea', () => {
  const invalid = structuredClone(recipe); invalid.options[0]!.price = null;
  assert.throws(() => freezeRecipe(invalid, items), /precio/);
  const twice = structuredClone(recipe); twice.options.push({ ...twice.options[0]!, id: 'second-substitution' });
  assert.throws(() => consumption(freezeRecipe(twice, items), ['oat-option', 'second-substitution']), /Solo una sustitución/);
  assert.equal(toBase('999999999', 'kg', 'g', null), '999999999000');
});
test('AC-002-07: sustitución reemplaza consumo, adicional suma precio/consumo y empaque permanece', () => {
  const active = freezeRecipe(recipe, items);
  assert.deepEqual(consumption(active, ['oat-option', 'extra']), { items: [{ itemId: 'cup', quantity: '1' }, { itemId: 'oat', quantity: '100' }, { itemId: 'fruit', quantity: '10' }], extraPrice: '1500' });
  assert.deepEqual(consumption(active).items, [{ itemId: 'milk', quantity: '100' }, { itemId: 'cup', quantity: '1' }]);
  assert.throws(() => consumption(active, ['extra', 'extra']), /duplicada/);
  assert.throws(() => consumption(active, ['unknown']), /inválida/);
  assert.equal(recipe.lines[0]!.baseQuantity, undefined, 'No mutar fuente');
});
test('AC-003-07: desconocido no es cero y costo exacto requiere todos los ingredientes', () => {
  const active = freezeRecipe(recipe, items);
  assert.equal(recipeCost(active, new Map([['milk', '2.5']])), null);
  assert.equal(recipeCost(active, new Map([['milk', '2.5'], ['cup', '0']])), '250');
});
