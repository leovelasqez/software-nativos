import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateDashboard, dashboardDates } from '../src/dashboard.ts';
import type { DashboardSale } from '../src/dashboard.ts';

const sale = (day: string, paid = '1000', quantity = '1', productId = 'p1'): DashboardSale => ({
  id: `sale-${day}`, day, occurredAt: day + 'T15:00:00Z', total: '9999',
  lines: [{ id: 'line', productId, name: productId, presentation: 'Unidad', quantity, paidAmount: paid }],
});

test('AC-017-02: día y mes de Colombia antes/después de medianoche', () => {
  assert.deepEqual(dashboardDates(new Date('2026-10-01T04:59:59Z')), {today:'2026-09-30',monthStart:'2026-09-01'});
  assert.deepEqual(dashboardDates(new Date('2026-10-01T05:00:00Z')), {today:'2026-10-01',monthStart:'2026-10-01'});
});

test('AC-017-02: importes históricos pagados, devoluciones, cantidades fraccionarias y ticket al peso', () => {
  const original = sale('2026-08-30', '20', '2');
  const result = aggregateDashboard('2026-09-19', [sale('2026-09-19','1000.4','2.5'), sale('2026-09-19','2000.6'), sale('2026-09-01','5000'), original, sale('2026-09-20','100000')], [
    {day:'2026-09-19',total:'170',tip:'50',shipping:'100',lines:[{lineId:'line',quantity:'0.5'}],sale:original},
    {day:'2026-08-30',total:'1000',tip:'0',shipping:'0',lines:[],sale:original},
  ]);
  assert.deepEqual(result.day, {sales:'2981',saleCount:2,refunds:'20'});
  assert.deepEqual(result.month, {sales:'7981',saleCount:3,refunds:'20'});
  assert.equal(result.ticketAverage, '1501');
  assert.equal(result.daily.length, 19);
  assert.deepEqual(result.daily[0], {date:'2026-09-01',sales:'5000'});
  assert.deepEqual(result.daily[18], {date:'2026-09-19',sales:'2981'});
  assert.deepEqual(result.topProducts, [{productId:'p1',name:'p1',presentation:'Unidad',quantity:'4'}]);
});

test('AC-017-02: legado sin paidAmount, cero cobros, devolución neta negativa y precisión', () => {
  const legacy = sale('2026-09-19'); delete legacy.lines[0]!.paidAmount; legacy.total='1234';
  assert.equal(aggregateDashboard('2026-09-19',[legacy],[]).day.sales, '1234');
  const empty = aggregateDashboard('2026-09-01',[],[]);
  assert.deepEqual(empty.day,{sales:'0',saleCount:0,refunds:'0'});
  assert.equal(empty.ticketAverage,null); assert.deepEqual(empty.topProducts,[]);
  const refunded = aggregateDashboard('2026-09-19',[],[{day:'2026-09-19',total:'9.000001',tip:'1',shipping:'2',lines:[{lineId:'line',quantity:'1'}],sale:legacy}]);
  assert.equal(refunded.day.sales,'-6.000001'); assert.equal(refunded.ticketAverage,null); assert.deepEqual(refunded.topProducts,[]);
  const large = aggregateDashboard('2026-09-19',[sale('2026-09-19','9007199254740993.123456')],[]);
  assert.equal(large.day.sales,'9007199254740993.123456');
});

test('AC-017-02: top cinco estable, unidades netas y nombre del comprobante más reciente', () => {
  const sales = Array.from({length:7}, (_,i)=>sale('2026-09-19','500',String(i+1),`p${i}`));
  const newer = sale('2026-09-19','0','0','p6'); newer.lines[0]!.name='Nombre actualizado'; newer.occurredAt='2026-09-19T23:00:00Z';
  const result = aggregateDashboard('2026-09-19',[...sales,newer],[{day:'2026-09-19',total:'0',tip:'0',shipping:'0',lines:[{lineId:'line',quantity:'7'}],sale:sales[6]!}]);
  assert.deepEqual(result.topProducts.map(p=>p.productId),['p5','p4','p3','p2','p1']);
  assert.equal(aggregateDashboard('2026-09-19',[newer,...sales],[]).topProducts[0]!.name,'Nombre actualizado');
});
