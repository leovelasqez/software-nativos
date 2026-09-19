import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeOrder } from '../src/orders-domain.ts';
import { orderNumbers, orderTabLabel, selectionAfterUpdate } from '../web/order-navigation.ts';
const orders=['first','second','third'].map(id=>upgradeOrder({id,revision:1,snapshotId:'snapshot',lines:[]}));
test('AC-016-08: numeración estable después del cierre y nombres de mesa/domicilio',()=>{
  const closed=orders.map((o,i)=>({...o,closed:i===1}));
  assert.deepEqual(orderNumbers(closed),{first:1,second:2,third:3});
  const fresh={...orders[0]!,id:'fresh'};
  assert.equal(orderNumbers(closed,fresh).fresh,4);
  assert.deepEqual(orderNumbers([...closed,fresh],fresh),orderNumbers(closed,fresh));
  assert.equal(orderTabLabel(orders[0]!,1),'Venta principal');
  assert.equal(orderTabLabel(orders[2]!,3),'Venta 3');
  assert.equal(orderTabLabel({...orders[0]!,mode:'table',label:'7'},1),'Mesa · 7');
  assert.equal(orderTabLabel({...orders[0]!,mode:'delivery',label:'Entrega Ana'},1),'Entrega Ana');
});
test('AC-016-08: cierre inactivo conserva selección; cierre activo elige vecino o venta nueva',()=>{
  assert.equal(selectionAfterUpdate(orders,'first',{...orders[1]!,closed:true}),'first');
  assert.equal(selectionAfterUpdate(orders,'second',{...orders[1]!,closed:true}),'third');
  assert.equal(selectionAfterUpdate(orders,'third',{...orders[2]!,closed:true}),'second');
  assert.equal(selectionAfterUpdate([orders[0]!],'first',{...orders[0]!,closed:true}),undefined);
  assert.equal(selectionAfterUpdate(orders,'first',orders[1]!),'second');
});
