import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { startLocalPostgres, freePort } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { seedNotificationReports } from '../notification-fixture.ts';

test('AC-009-08/11 — WhatsApp dueño, enlace/login, Excel y temas/móvil sin envíos',async({page,browser})=>{
  test.setTimeout(180_000);
  const db=await startLocalPostgres(resolve('.local/whatsapp-browser-'+randomUUID()),{password:randomBytes(32).toString('hex')});
  const port=await freePort();const origin=`http://127.0.0.1:${port}`;const app=await createApp({pool:db.pool,origin,staticRoot:resolve('dist')});
  const password=randomBytes(24).toString('base64url');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await migrate(db.pool);await app.listen({port,host:'127.0.0.1'});await page.setViewportSize({width:1440,height:1000});await page.goto(origin);
    await page.getByLabel('Nombre completo').fill('Dueño WhatsApp');await page.getByLabel('Usuario',{exact:true}).fill('whatsapp-browser-owner');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Crear mi acceso'}).click();
    await expect(page.getByRole('heading',{name:'Hola, Dueño'})).toBeVisible();
    const owner=(await db.pool.query("SELECT id FROM app_users WHERE login='whatsapp-browser-owner'")).rows[0].id;
    const {first}=await seedNotificationReports(db.pool,owner);
    await page.getByRole('navigation').getByRole('button',{name:'WhatsApp',exact:true}).click();
    await expect(page.getByRole('heading',{name:'WhatsApp',exact:true})).toBeVisible();await expect(page.getByText('Envío desactivado',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Ver reporte'})).toHaveCount(2);
    await page.goto(origin+`/?notification=${first.id}`);await expect(page.getByRole('region',{name:'Detalle del reporte'})).toBeVisible();
    await expect(page.getByText('Consolidado parcial: hay un turno abierto',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'Probar entrega sin enviar'}).click();await expect(page.getByText('Prueba completada: entrega simulada.',{exact:false})).toBeVisible();
    expect((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[first.id])).rows[0].state).toBe('pending');
    expect((await db.pool.query('SELECT count(*) FROM notification_attempts')).rows[0].count).toBe('0');
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel del reporte'}).click();expect((await download).suggestedFilename()).toMatch(/nativos-whatsapp-2026-10-15\.xlsx/);
    const output=resolve('docs/evidence/whatsapp-2026-10-15');await mkdir(output,{recursive:true});
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      for(const dark of [false,true]) {
        const toggle=page.getByRole('switch',{name:'Modo oscuro'});if((await toggle.getAttribute('aria-checked'))!==String(dark))await toggle.click();
        expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:resolve(output,`${width}-${dark?'dark':'light'}.png`),fullPage:true});
      }
    }
    // A direct link survives a new browser context and the login form.
    const fresh=await browser.newContext();try {
      const p=await fresh.newPage();await p.goto(origin+`/?notification=${first.id}`);await p.getByLabel('Usuario',{exact:true}).fill('whatsapp-browser-owner');await p.getByLabel('Contraseña',{exact:true}).fill(password);await p.getByRole('button',{name:'Entrar a Nativos'}).click();await expect(p.getByRole('region',{name:'Detalle del reporte'})).toBeVisible();
      await p.keyboard.press('Tab');expect(await p.locator(':focus').count()).toBe(1);
    }finally{await fresh.close();}
    const cashier=await page.request.post(origin+'/api/users',{headers:{'X-Nativos-Request':'1'},data:{name:'Cajero prueba',login:'whatsapp-browser-cashier',password,role:'cashier',branchIds:['centro'],reason:'Prueba de permisos WhatsApp'}});expect(cashier.status()).toBe(201);
    const cashierContext=await browser.newContext();try {
      const p=await cashierContext.newPage();await p.goto(origin);await p.getByLabel('Usuario',{exact:true}).fill('whatsapp-browser-cashier');await p.getByLabel('Contraseña',{exact:true}).fill(password);await p.getByRole('button',{name:'Entrar a Nativos'}).click();await expect(p.getByRole('heading',{name:'Hola, Cajero'})).toBeVisible();
      await expect(p.getByRole('navigation').getByRole('button',{name:'WhatsApp',exact:true})).toHaveCount(0);
      for(const path of ['/api/notifications/config',`/api/notifications/${first.id}`,`/api/notifications/${first.id}/export`])expect((await p.request.get(origin+path)).status()).toBe(403);
    }finally{await cashierContext.close();}
    expect(errors).toEqual([]);
  }finally{await app.close();await db.stop();}
});
