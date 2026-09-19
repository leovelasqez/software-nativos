import test from 'node:test';
import assert from 'node:assert/strict';
import { reportLabel, reportValue } from '../web/report-format.ts';
test('AC-017-01: informes legibles, cantidades sin moneda y detalle histórico preservado',()=>{
  assert.equal(reportLabel('cashApplied'),'Efectivo aplicado');
  assert.match(reportValue('total','12500.125'), /12\.500,125/);
  assert.equal(reportValue('quantity','1.5'),'1,5');
  assert.equal(reportValue('minimum',null),'—');
  assert.equal(reportValue('kind','refund'),'Devolución');
  assert.equal(reportValue('customer',{name:'Cliente'}),'Cliente');
  assert.equal(reportValue('reference','cash'),'cash');
  assert.equal(reportValue('recoverable',false),'No');
  assert.match(reportValue('occurredAt','2026-09-20T02:00:00Z'),/19\/0?9\/2026/);
});
