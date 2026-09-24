import { expect, type Page } from '@playwright/test';

export async function exerciseCajaAccess(parent:Page,password:string){
  const browser=parent.context().browser()!;
  const first=await browser.newContext({baseURL:'http://127.0.0.1:4320'});
  const second=await browser.newContext({baseURL:'http://127.0.0.1:4320'});
  async function activate(page:Page){
    await page.goto('/caja');await page.getByLabel('Usuario',{exact:true}).fill('e2e-owner');
    await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar a caja'}).click();
    await page.getByLabel('Equipo').selectOption('centro-caja');await page.getByRole('button',{name:'Activar caja',exact:true}).click();
    await expect(page.getByLabel('Sucursal',{exact:true})).toHaveValue('centro-caja');
  }
  async function open(page:Page,amount:string){
    await page.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();
    await page.getByRole('button',{name:'Abrir turno',exact:true}).click();
    await page.getByLabel('Base de efectivo (COP)').fill(amount);await page.getByRole('button',{name:'Confirmar apertura'}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  }
  async function close(page:Page,amount:string){
    await page.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();
    await page.getByRole('button',{name:'Cerrar turno',exact:true}).click();await page.getByLabel('Efectivo contado (COP)').fill(amount);
    await page.getByRole('button',{name:'Confirmar cierre'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  }
  async function switchTo(page:Page,id:string){
    await page.getByLabel('Sucursal',{exact:true}).selectOption(id);
    await expect(page.locator('.sidebar-account small')).toHaveText(id);
  }
  try{
    const a=await first.newPage(),b=await second.newPage();await activate(a);await open(a,'100');
    // AC-018-03: an unavailable destination must preserve the active profile and shift.
    await a.route('**/api/pos/enroll',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Destino temporalmente no disponible'})}));
    await a.getByLabel('Sucursal',{exact:true}).selectOption('milan-caja');await expect(a.getByRole('alert')).toContainText('Destino temporalmente no disponible');
    await a.unrouteAll();await a.reload();await expect(a.getByLabel('Sucursal',{exact:true})).toHaveValue('centro-caja');
    await a.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();await expect(a.getByRole('button',{name:'Cerrar turno',exact:true})).toBeEnabled();
    await switchTo(a,'milan-caja');await open(a,'200');
    await switchTo(a,'centro-caja');await a.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();await expect(a.locator('.pos-shift')).toContainText('Base: $ 100');
    // AC-018-01/04: another browser enters both boxes without evicting the first.
    await activate(b);await b.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();
    await b.getByRole('button',{name:'Abrir turno',exact:true}).click();await b.getByLabel('Base de efectivo (COP)').fill('0');await b.getByRole('button',{name:'Confirmar apertura'}).click();
    await expect(b.getByRole('dialog').getByRole('alert')).toContainText('en otro navegador');await b.getByRole('dialog').getByRole('button',{name:'Cerrar formulario',exact:true}).click();
    await expect(b.locator('.pos-sync')).toContainText('0 pendientes');
    await switchTo(b,'milan-caja');
    await b.reload();await expect(b.getByLabel('Sucursal',{exact:true})).toHaveValue('milan-caja');
    await a.reload();await a.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();await expect(a.locator('.pos-shift')).toContainText('Base: $ 100');
    await a.screenshot({path:'test-results/caja-access/open-centro.png',fullPage:true});
    await close(a,'100');await switchTo(a,'milan-caja');await close(a,'200');
  }finally{await first.close();await second.close();}
}
