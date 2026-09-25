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
  async function sale(page:Page){
    await page.getByRole('navigation').getByRole('button',{name:'Venta',exact:true}).click();
    await page.getByRole('button',{name:'Datos del pedido'}).click();
    await page.getByLabel('Atención').selectOption('delivery');
    await page.getByLabel('Dirección del domicilio').fill('Dirección sintética de prueba');
    await page.getByLabel('Envío pendiente (COP)').fill('2000');
    await page.getByRole('button',{name:'Guardar pedido',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button').filter({hasText:'Batido de prueba'}).click();
    await page.getByRole('button',{name:'Guardar en pedido',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Cobrar pedido',exact:true}).click();
    await page.getByLabel('Propina voluntaria').fill('1000');
    await page.getByLabel('Envío a cobrar (COP)').fill('2000');
    await page.getByLabel('Importe 1 (COP)').fill('16000');
    await page.getByRole('button',{name:'Confirmar cobro'}).click();
    await expect(page.getByRole('heading',{name:'Comprobante interno'})).toBeVisible();
    await page.keyboard.press('Escape');
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
    // AC-018-05/07: the original browser keeps a real offline sale while the second resumes.
    await first.setOffline(true);await sale(a);
    await activate(b);await b.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();
    await expect(b.getByRole('button',{name:'Continuar este turno',exact:true})).toBeEnabled();
    await b.screenshot({path:'test-results/caja-access/continue-turn.png',fullPage:true});
    for(const dark of [false,true]){
      await b.setViewportSize({width:390,height:844});
      const toggle=b.getByRole('switch',{name:'Modo oscuro'});if((await toggle.getAttribute('aria-checked')==='true')!==dark)await toggle.click();
      await expect(b.getByRole('button',{name:'Continuar este turno',exact:true})).toBeInViewport();
      expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      await b.screenshot({path:`test-results/caja-access/continue-mobile-${dark?'dark':'light'}.png`,fullPage:true});
    }
    await b.setViewportSize({width:1280,height:720});
    await b.getByRole('button',{name:'Continuar este turno',exact:true}).click();
    await expect(b.locator('.pos-shift')).toContainText('Base: $ 100');
    await expect(b.locator('.pos-shift')).toContainText('Efectivo esperado: $ 100');
    await b.getByRole('button',{name:'Registrar ingreso o salida',exact:true}).click();
    await b.getByLabel('Importe (COP)').fill('50');await b.getByLabel('Motivo').fill('Ingreso desde segundo navegador');
    await b.getByRole('button',{name:'Registrar movimiento',exact:true}).click();await expect(b.getByRole('dialog')).not.toBeVisible();
    await first.setOffline(false);
    await a.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(a.locator('.pos-sync')).toContainText('0 pendientes');
    await b.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(b.locator('.pos-shift')).toContainText('Efectivo esperado: $ 16.150');
    await expect(b.locator('.pos-shift')).toContainText('Propina neta del turno: $ 1.000 · Domicilio neto: $ 2.000');
    await b.getByRole('navigation').getByRole('button',{name:'Comprobantes',exact:true}).click();
    await expect(b.getByRole('button',{name:'Ver copia',exact:true})).toHaveCount(1);
    await sale(b);await b.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(b.locator('.pos-sync')).toContainText('0 pendientes');
    // A reloaded second browser and the original converge without duplicating receipts or totals.
    await switchTo(b,'milan-caja');
    await b.reload();await expect(b.getByLabel('Sucursal',{exact:true})).toHaveValue('milan-caja');
    await switchTo(b,'centro-caja');
    await a.reload();await a.getByRole('button',{name:'Sincronizar',exact:true}).click();await a.getByRole('navigation').getByRole('button',{name:'Turno',exact:true}).click();
    await expect(a.locator('.pos-shift')).toContainText('Efectivo esperado: $ 32.150');
    await expect(a.locator('.pos-shift')).toContainText('Propina neta del turno: $ 2.000 · Domicilio neto: $ 4.000');
    await a.screenshot({path:'test-results/caja-access/open-centro.png',fullPage:true});
    await b.getByRole('navigation').getByRole('button',{name:'Comprobantes',exact:true}).click();
    await b.getByRole('button',{name:'Devolver',exact:true}).last().click();
    await b.getByLabel('Devolver · Batido de prueba').fill('1');
    await b.getByLabel('Propina a devolver (COP)').fill('1000');await b.getByLabel('Domicilio a devolver (COP)').fill('2000');
    await b.getByRole('button',{name:'Devolver total en efectivo'}).click();await b.getByLabel('Motivo de devolución').fill('Devolución sintética desde segundo equipo');
    await b.getByRole('button',{name:'Confirmar devolución'}).click();await expect(b.getByRole('dialog')).not.toBeVisible();
    await b.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(b.locator('.pos-sync')).toContainText('0 pendientes');
    await a.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(a.locator('.pos-shift')).toContainText('Efectivo esperado: $ 16.150');
    await expect(a.locator('.pos-shift')).toContainText('Propina neta del turno: $ 1.000 · Domicilio neto: $ 2.000');
    await a.getByRole('button',{name:'Corregir',exact:true}).click();await a.getByLabel('Motivo').fill('Contrapartida sintética desde primer equipo');
    await a.getByRole('button',{name:'Registrar contrapartida'}).click();await expect(a.getByRole('dialog')).not.toBeVisible();
    await expect(a.locator('.pos-shift')).toContainText('Efectivo esperado: $ 16.100');
    await close(b,'16100');await a.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(a.locator('.pos-shift')).toContainText('No hay un turno abierto');
    await expect(a.locator('.pos-shift')).toContainText('Diferencia: $ 0');
    await a.getByRole('navigation').getByRole('button',{name:'Comprobantes',exact:true}).click();await expect(a.getByRole('button',{name:'Ver copia',exact:true})).toHaveCount(2);
    await switchTo(a,'milan-caja');await close(a,'200');
  }finally{await first.close();await second.close();}
}
