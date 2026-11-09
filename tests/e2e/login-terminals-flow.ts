import { expect, type Page } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function exerciseLoginTerminals(parent: Page, password: string) {
  const context = await parent.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:4320' });
  try {
    const page = await context.newPage();
    let offline=false;
    async function login(user: string) {
      await page.getByLabel('Usuario', { exact: true }).fill(user);
      await page.getByLabel('Contraseña', { exact: true }).fill(password);
      if(offline){await page.getByRole('button',{name:'Entrar a caja',exact:true}).click();return;}
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/login');
      await page.getByRole('button', { name: 'Entrar a caja', exact: true }).click();
      const result=await response;
      if(result.status()===429){
        // This regression performs many legitimate logins from one IP; honor the server's limit.
        const delay=Math.min(60,Math.max(1,Number(result.headers()['retry-after'])||60))*1000;
        await page.waitForTimeout(delay);
        const retry=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/login');
        await page.getByRole('button',{name:'Entrar a caja',exact:true}).click();
        expect((await retry).status()).toBe(200);
      } else expect(result.status()).toBe(200);
    }
    async function logout() {
      await page.getByRole('button', { name: 'Salir', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Inicia sesión en caja' })).toBeVisible();
    }
    const entry=await page.goto('/caja');
    expect(entry?.headers()['cache-control']).toBe('no-store');
    expect((await page.request.get('/sw.js')).headers()['cache-control']).toBe('no-store');
    // AC-018-12: a cashier is the very first user of this empty browser context.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    await page.screenshot({ path: 'test-results/login-terminals/fresh-cashier.png', fullPage: true });
    await logout();
    // AC-018-15: reproduce Centro's saved, obsolete browser token in real IndexedDB.
    const beforeRecovery = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve,reject) => {
        const request=indexedDB.open('nativos-caja',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      try {
        const read=(name:string)=>new Promise<any>((resolve,reject)=>{
          const request=db.transaction('state','readonly').objectStore('state').get(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        const [key,record]=await Promise.all([read('key'),read('root')]);
        const data=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,record.cipher)));
        const original={installationId:data.installationId,sequence:data.sequence,orders:data.orders,shifts:data.shifts};
        data.terminal.token='obsolete-browser-token';data.users['e2e-cashier'].revoked=true;
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
        await new Promise<void>((resolve,reject)=>{
          const transaction=db.transaction('state','readwrite');transaction.objectStore('state').put({iv,cipher},'root');transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);
        });
        return original;
      } finally { db.close(); }
    });
    let sameInstallation=false;
    const observeRecovery=(request:import('@playwright/test').Request)=>{
      if(new URL(request.url()).pathname==='/api/pos/enroll')sameInstallation=request.postDataJSON().installationId===beforeRecovery.installationId;
    };
    page.on('request',observeRecovery);
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact:true })).toHaveValue('centro-caja');
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    expect(sameInstallation).toBe(true);page.off('request',observeRecovery);
    await page.screenshot({path:'test-results/login-terminals/revalidated-centro.png',fullPage:true});
    await logout();
    await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('milan-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await logout();
    // AC-018-08/12: the owner's Milán preference does not change the cashier's branch.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.getByLabel('Sucursal', { exact: true }).locator('option')).toHaveCount(1);
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    // A separate private context enters with the same credentials and no owner's session.
    const other = await parent.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:4320' });
    try {
      const otherPage = await other.newPage();
      // Admin login succeeds even when its first attempt to prepare this browser fails.
      await otherPage.route('**/api/pos/enroll', route => route.fulfill({
        status:503, contentType:'application/json',
        body:JSON.stringify({code:'unavailable',message:'Preparación temporalmente no disponible.'})
      }), { times:1 });
      await otherPage.goto('/');
      await otherPage.getByLabel('Usuario', { exact: true }).fill('e2e-cashier');
      await otherPage.getByLabel('Contraseña', { exact: true }).fill(password);
      await otherPage.getByRole('button', { name: 'Entrar a Nativos', exact: true }).click();
      await otherPage.getByRole('link', { name: 'Caja y ventas', exact: true }).click();
      await expect(otherPage.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
      await otherPage.getByText('Habilitar el ingreso a Caja sin internet', { exact: true }).click();
      await otherPage.getByLabel('Contraseña de tu cuenta').fill(password);
      await otherPage.getByRole('button', { name: 'Habilitar ingreso sin internet' }).click();
      await expect(otherPage.getByLabel('Contraseña de tu cuenta')).toHaveCount(0);
      await otherPage.getByRole('button', { name: 'Salir', exact: true }).click();
      await expect(otherPage.getByLabel('Usuario', { exact: true })).toBeVisible();
      await other.setOffline(true);
      await otherPage.getByLabel('Usuario', { exact: true }).fill('e2e-cashier');
      await otherPage.getByLabel('Contraseña', { exact: true }).fill(password);
      await otherPage.getByRole('button', { name: 'Entrar a caja', exact: true }).click();
      await expect(otherPage.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    } finally { await other.close(); }
    await page.screenshot({ path: 'test-results/login-terminals/cashier-centro.png', fullPage: true });
    await logout();await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('centro-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await logout();await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await logout();await login('e2e-owner');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.getByLabel('Sucursal', { exact: true }).selectOption('milan-caja');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('milan-caja');
    await logout();await context.setOffline(true);offline=true;
    // AC-018-11: the cashier can recover their saved Centro profile offline.
    await login('e2e-cashier');
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await page.reload();
    await expect(page.getByLabel('Sucursal', { exact: true })).toHaveValue('centro-caja');
    await expect(page.locator('.sidebar-account strong')).toHaveText('Cajero verificado');
    // AC-018-16: do not interrupt a typed login; activate when the login is empty.
    await context.setOffline(false);offline=false;await logout();
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.getByLabel('Usuario',{exact:true}).fill('e2e-cashier');
    const workerPath=resolve('dist/sw.js'),originalWorker=await readFile(workerPath,'utf8');
    try {
      await writeFile(workerPath,originalWorker+'\n// AC-018-16 login update '+Date.now()+'\n');
      const waiting=await page.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration('/');
        if(!registration)throw new Error('Missing worker');
        await registration.update();
        if(registration.waiting)return true;
        return new Promise<boolean>((resolve,reject)=>{
          const timeout=setTimeout(()=>reject(new Error('Update did not wait')),20000);
          const inspect=()=>{if(registration.waiting){clearTimeout(timeout);resolve(true);}};
          registration.installing?.addEventListener('statechange',inspect);
          registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',inspect));
          inspect();
        });
      });
      expect(waiting).toBe(true);
      await expect(page.getByLabel('Usuario',{exact:true})).toHaveValue('e2e-cashier');
      await page.getByLabel('Usuario',{exact:true}).fill('');
      const refreshed=page.waitForEvent('load');
      await page.evaluate(()=>window.dispatchEvent(new Event('nativos-login-ready')));
      await refreshed;
      await expect(page.getByRole('heading',{name:'Inicia sesión en caja'})).toBeVisible();
      await expect(page.getByLabel('Usuario',{exact:true})).toHaveValue('');
    } finally { await writeFile(workerPath,originalWorker); }
  } finally { await context.close(); }
}
