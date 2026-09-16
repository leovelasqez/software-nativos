import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { audit, transaction } from './db.ts';
import { authenticate, requireAccess, ApiError } from './security.ts';
import { payloadHash } from '../pos-crypto.ts';
import type { Customer } from '../orders-domain.ts';
import contract from '../../contracts/customers-v1.schema.json' with { type: 'json' };
export function registerCustomers(app: FastifyInstance, pool: Pool) {
  app.post('/api/customers', { schema: { body: contract.create } }, req => transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7301)'); const actor = await authenticate(c,req);
    const b = req.body as Omit<Customer,'id'> & { operationId: string; branchId: string }; requireAccess(actor,b.branchId,'customer.create');
    const fingerprint = payloadHash(JSON.stringify({ route:'customer.create',...b })); const old = (await c.query('SELECT * FROM catalog_operations WHERE id=$1',[b.operationId])).rows[0];
    if (old) { if (old.actor_id !== actor.user.id || old.fingerprint !== fingerprint) throw new ApiError(409,'operation_conflict','La operación pertenece a otro contenido.'); return old.response; }
    const document = b.document.trim(); const key = document.replace(/\s+/g,'').toUpperCase();
    if (b.name.trim().length < 2 || key.length < 3 || !/^[+\d ()-]{5,30}$/.test(b.phone) || b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) throw new ApiError(400,'invalid_customer','Revisa nombre, documento, celular y correo.');
    const duplicate = (await c.query('SELECT data FROM customers WHERE document_key=$1',[key])).rows[0];
    if (duplicate) throw new ApiError(409,'customer_exists',`El documento ya está registrado: ${duplicate.data.name}. Búscalo y selecciónalo.`);
    const customer: Customer = { id:randomUUID(),name:b.name.trim(),document,phone:b.phone.trim(),email:b.email.trim(),address:b.address.trim() };
    await c.query('INSERT INTO customers VALUES($1,$2,$3)',[customer.id,key,JSON.stringify(customer)]);
    await audit(c,actor,'customer.created','Alta de cliente',{ customerId:customer.id },b.branchId);
    await c.query('INSERT INTO catalog_operations VALUES($1,$2,$3,$4)',[b.operationId,actor.user.id,fingerprint,JSON.stringify(customer)]); return customer;
  }));
  app.get('/api/customers', { schema: { querystring: { type:'object',additionalProperties:false,required:['branchId'],properties:{branchId:{type:'string',maxLength:128},after:{type:'string',maxLength:128},q:{type:'string',maxLength:100}} } } }, async req => {
    const q = req.query as { branchId:string;after?:string;q?:string }; const actor = await authenticate(pool,req); requireAccess(actor,q.branchId);
    const rows = (await pool.query("SELECT id,data FROM customers WHERE id>$1 AND ($2='' OR lower(data->>'name') LIKE $2 OR lower(data->>'document') LIKE $2 OR data->>'phone' LIKE $2) ORDER BY id LIMIT 101",[q.after??'',q.q ? '%'+q.q.toLowerCase()+'%' : ''])).rows;
    return { items:rows.slice(0,100).map(r=>r.data),nextCursor:rows.length>100?rows[99].id:null };
  });
  app.get('/api/customers/:id/history', {schema:{querystring:{type:'object',additionalProperties:false,required:['branchId'],properties:{branchId:{type:'string',maxLength:128},after:{type:'string',maxLength:128}}},params:{type:'object',required:['id'],properties:{id:{type:'string',maxLength:128}}}}},async req=>{
    const q=req.query as {branchId:string;after?:string};const {id}=req.params as {id:string};const actor=await authenticate(pool,req);requireAccess(actor,q.branchId);
    const rows=(await pool.query("SELECT id,data FROM pos_sales WHERE branch_id=$1 AND data->'customer'->>'id'=$2 AND id>$3 ORDER BY id LIMIT 101",[q.branchId,id,q.after??''])).rows;
    const items=rows.slice(0,100);const refunds=items.length?(await pool.query('SELECT data FROM pos_refunds WHERE sale_id=ANY($1::text[])',[items.map(r=>r.id)])).rows.map(r=>r.data):[];
    return {items:items.map(r=>({sale:r.data,refunds:refunds.filter(rf=>rf.saleId===r.id)})),nextCursor:rows.length>100?rows[99].id:null};
  });

}
