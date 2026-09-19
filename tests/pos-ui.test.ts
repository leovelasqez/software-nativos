import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, exactPayment, paymentPreview } from '../web/pos-ui.ts';

test('AC-016-02: búsqueda por palabras, tildes y espacios', () => {
  assert.ok(matchesSearch('Café frío REF-20', '  CAFE   frio '));
  assert.ok(matchesSearch('Café frío REF-20', 'ref-20 cafe'));
  assert.equal(matchesSearch('Café frío REF-20', 'caliente'), false);
});
test('AC-016-05: importe recibido se deriva exactamente, cambio sólo válido en efectivo', () => {
  assert.deepEqual(paymentPreview('100.3', [{method:'cash',received:'50.1'},{method:'nequi',received:'50.2'}]), {received:'100.3',missing:'0',change:'0',error:''});
  assert.equal(paymentPreview('100', [{method:'cash',received:'100'},{method:'nequi',received:'50'}]).change, '50');
  const digital = paymentPreview('100', [{method:'cash',received:'10'},{method:'nequi',received:'101'}]);
  assert.equal(digital.change, null);
  assert.ok(digital.error);
  assert.equal(paymentPreview('100', [{method:'cash',received:'70'}]).missing,'30');
  assert.equal(paymentPreview('100', [{method:'cash',received:''}]).received,null);
  assert.ok(paymentPreview('100', [{method:'cash',received:'50'},{method:'cash',received:'50'}]).error);
});
test('AC-016-05: importe exacto conserva los otros pagos y resta con precisión', () => {
  const payments = [{method:'cash' as const,received:'0'},{method:'nequi' as const,received:'50.2'}];
  assert.deepEqual(exactPayment('100.3',payments,0),[{method:'cash',received:'50.1'},payments[1]]);
  assert.equal(payments[0]!.received,'0');
  assert.throws(()=>exactPayment('40',payments,0),/superan/);
});
