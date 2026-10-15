import type { Pool } from 'pg';
import { transaction } from '../src/server/db.ts';
import { queueShiftClosed } from '../src/server/notifications-api.ts';

// Synthetic only. All money is explicit; no production sources or credentials.
export async function seedNotificationReports(pool:Pool,actorId:string) {
  const at='2026-10-15T15:00:00Z';
  await pool.query(`INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES('notify-centro','centro-caja','centro',$1,150000,'2026-10-15T12:00:00Z',$2,158000,158000,0),('notify-milan','milan-caja','milan',$1,0,'2026-10-15T12:00:00Z',NULL,NULL,NULL,NULL)`,[actorId,at]);
  const sale={id:'notify-sale',receiptNumber:'CENTRO-PRUEBA',occurredAtMs:Date.parse(at)-1000,actorName:'Dueño prueba',total:'20000',products:'17000',tipPaid:'1000',shippingPaid:'2000',change:'3000',cashApplied:'7000',payments:[{method:'cash',received:'10000',applied:'7000'},{method:'nequi',received:'13000',applied:'13000'}]};
  await pool.query(`INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$1,'notify-centro','centro-caja','centro',$2,$3,$4,7000,$5,false)`,[sale.id,actorId,sale.receiptNumber,JSON.stringify(sale),new Date(sale.occurredAtMs)]);
  const refund={id:'notify-refund',saleId:sale.id,occurredAtMs:Date.parse(at)-500,actorName:'Dueño prueba',reason:'Devolución sintética',total:'5000',tip:'500',shipping:'1000',cashApplied:'-2000',payments:[{method:'cash',received:'2000'},{method:'nequi',received:'3000'}]};
  await pool.query(`INSERT INTO pos_refunds(id,sale_id,shift_id,data,cash_applied) VALUES($1,$2,'notify-centro',$3,-2000)`,[refund.id,sale.id,JSON.stringify(refund)]);
  for(const [key,kind,amount,delta,reverse] of [['income','income','5000','5000',null],['expense','expense','2000','-2000',null],['withdrawal','withdrawal','1000','-1000',null],['correction','correction','1000','1000','notify-withdrawal']] as const) {
    await pool.query(`INSERT INTO pos_cash_movements(id,shift_id,device_id,branch_id,actor_id,class,payment_method,amount,cash_delta,reverses_id,reason,occurred_at,data) VALUES($1,'notify-centro','centro-caja','centro',$2,$3,'cash',$4,$5,$6,'Movimiento sintético',$7,'{}')`,[`notify-${key}`,actorId,kind,amount,delta,reverse,at]);
  }
  await transaction(pool,c=>queueShiftClosed(c,'notify-centro'));
  const first=(await pool.query("SELECT id,data FROM notification_intents WHERE dedupe_key='owner-close:notify-centro'")).rows[0];
  const saleMilan={...sale,id:'notify-sale-milan',receiptNumber:'MILAN-PRUEBA',total:'10000',products:'10000',tipPaid:'0',shippingPaid:'0',change:'0',cashApplied:'10000',payments:[{method:'cash',received:'10000',applied:'10000'}]};
  await pool.query(`INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$1,'notify-milan','milan-caja','milan',$2,$3,$4,10000,$5,false)`,[saleMilan.id,actorId,saleMilan.receiptNumber,JSON.stringify(saleMilan),new Date(saleMilan.occurredAtMs)]);
  await pool.query(`UPDATE pos_shifts SET closed_at=$1,expected=10000,counted=10000,difference=0 WHERE id='notify-milan'`,[at]);
  await transaction(pool,c=>queueShiftClosed(c,'notify-milan'));
  const second=(await pool.query("SELECT id,data FROM notification_intents WHERE dedupe_key='owner-close:notify-milan'")).rows[0];
  return {first,second};
}
