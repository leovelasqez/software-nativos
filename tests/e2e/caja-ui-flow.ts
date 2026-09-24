import { expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function exerciseCajaUi(page: Page) {
  const root = 'test-results/caja-ui';
  await mkdir(root, {recursive:true});
  const initialOrder = await page.getByRole('tab',{selected:true}).getAttribute('data-order-id');
  // AC-016-08: real IndexedDB/outbox, not mocked UI state.
  const emptyTabs:string[]=[];
  for(let i=0;i<8;i++){
    await page.getByRole('button',{name:'+ Nuevo pedido',exact:true}).click();
    await expect(page.getByRole('tab')).toHaveCount(i+2);
    emptyTabs.push((await page.getByRole('tab',{selected:true}).getAttribute('data-order-id'))!);
  }
  const tab=(id:string)=>page.locator(`[role="tab"][data-order-id="${id}"]`);
  await tab(initialOrder!).click();await expect(page.getByRole('region',{name:'Pedido'})).toContainText('2 × Batido');
  await tab(initialOrder!).press('ArrowRight');await expect(tab(emptyTabs[0]!)).toHaveAttribute('aria-selected','true');
  await expect(tab(emptyTabs[0]!)).toBeFocused();
  await page.keyboard.press('End');await expect(tab(emptyTabs[7]!)).toHaveAttribute('aria-selected','true');
  await expect(tab(emptyTabs[7]!)).toBeFocused();await expect(tab(emptyTabs[7]!)).toBeInViewport();
  await page.keyboard.press('Home');await expect(tab(initialOrder!)).toHaveAttribute('aria-selected','true');
  await tab(emptyTabs[0]!).locator('..').getByRole('button',{name:/Cerrar/}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();await expect(tab(emptyTabs[0]!)).toHaveCount(0);
  await page.context().setOffline(true);
  await tab(emptyTabs[1]!).locator('..').getByRole('button',{name:/Cerrar/}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(tab(emptyTabs[1]!)).toHaveCount(0);await expect(tab(initialOrder!)).toHaveAttribute('aria-selected','true');
  await page.reload();await expect(tab(initialOrder!)).toHaveAttribute('aria-selected','true');
  await expect(tab(emptyTabs[0]!)).toHaveCount(0);await expect(tab(emptyTabs[1]!)).toHaveCount(0);await expect(page.getByRole('region',{name:'Pedido'})).toContainText('2 × Batido');
  await page.context().setOffline(false);
  await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(page.locator('.pos-sync')).toContainText('0 pendientes');
  await page.screenshot({path:`${root}/open-order-tabs.png`});
  await tab(emptyTabs[2]!).click();
  for(const id of emptyTabs.slice(2)){
    await tab(id).locator('..').getByRole('button',{name:/Cerrar/}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();await expect(tab(id)).toHaveCount(0);
  }
  await expect(tab(initialOrder!)).toHaveAttribute('aria-selected','true');
  // Synthetic long catalog, created through the same authenticated API as ProductForm.
  for (let i=0;i<30;i++) {
    const response = await page.request.post('/api/products', { headers:{origin:'http://127.0.0.1:4320','X-Nativos-Request':'1'}, data:{
      branchId:'centro',operationId:randomUUID(),reason:'AC-016 catálogo sintético',
      name:`Café de revisión ${String(i+1).padStart(2,'0')}`,reference:`UI-CAFE-${i+1}`,type:'finished',
      category:i<15?'Cafetería':'Bebidas',presentation:'Unidad de prueba',unit:'unit',price:'5000',tax:null,description:''
    }});
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await page.getByRole('button',{name:'+ Nuevo pedido',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Buscar producto'});
  await search.fill('  CAFE   revisión ');
  await expect(page.locator('.pos-product')).toHaveCount(30);
  await page.getByRole('button',{name:'Cafetería',exact:true}).click();
  await expect(page.locator('.pos-product')).toHaveCount(15);
  await search.fill('inexistente');await expect(page.getByText('No encontramos productos')).toBeVisible();
  await page.getByRole('button',{name:'Mostrar todos',exact:true}).click();
  for(let i=1;i<=12;i++){
    await search.fill(`UI-CAFE-${i} `);
    await page.locator('.pos-product').filter({hasText:`Café de revisión ${String(i).padStart(2,'0')}`}).click();
    await page.getByRole('button',{name:'Guardar en pedido',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await page.getByRole('button',{name:'Limpiar',exact:true}).click();
  const quickQuantity=page.getByRole('button',{name:'Cantidad de Café de revisión 01',exact:true});
  await expect(page.getByRole('button',{name:'Disminuir cantidad de Café de revisión 01',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Aumentar cantidad de Café de revisión 01',exact:true}).click();
  await expect(quickQuantity).toHaveText('2');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Disminuir cantidad de Café de revisión 01',exact:true}).click();
  await expect(quickQuantity).toHaveText('1');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // AC-016-10: immediate removal survives offline reload and keeps the other lines.
  await page.context().setOffline(true);
  await page.getByRole('button',{name:'Quitar Café de revisión 12',exact:true}).click();
  await expect(page.locator('.pos-order-line')).toHaveCount(11);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.pos-total')).toContainText('55.000');
  await page.reload();
  await expect(page.locator('.pos-order-line')).toHaveCount(11);
  await expect(page.getByRole('button',{name:'Quitar Café de revisión 12',exact:true})).toHaveCount(0);
  await page.context().setOffline(false);
  await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await search.fill('UI-CAFE-12');
  await page.locator('.pos-product').filter({hasText:'Café de revisión 12'}).click();
  await page.getByRole('button',{name:'Guardar en pedido',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.pos-order-line')).toHaveCount(12);
  await page.getByRole('button',{name:'Limpiar',exact:true}).click();
  await page.getByRole('button',{name:'Cantidad de Café de revisión 01',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Cantidad',{exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  for(const viewport of [{width:1366,height:768,name:'desktop'},{width:1024,height:768,name:'tablet'},{width:390,height:844,name:'mobile'}]) {
    await page.setViewportSize(viewport);
    for(const dark of [false,true]){
      const toggle=page.getByRole('switch',{name:'Modo oscuro'});
      if((await toggle.getAttribute('aria-checked')==='true')!==dark)await toggle.click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      if(viewport.width>800){
        const charge=page.getByRole('button',{name:'Cobrar pedido',exact:true});
        // Long orders grow naturally; no lines are trapped in an internal scroller.
        expect(await page.locator('.pos-order-lines').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBeTruthy();
        await page.locator('.pos-products').evaluate(el=>el.scrollTop=el.scrollHeight);
        await charge.scrollIntoViewIfNeeded();
        await expect(charge).toBeInViewport();
      } else {
        await expect(search).toBeInViewport();await expect(page.getByRole('button',{name:'Cobrar',exact:true})).toBeInViewport();
        const tabs=await page.locator('.pos-order-tabs').boundingBox();
        const charge=await page.getByRole('button',{name:'Cobrar',exact:true}).boundingBox();
        expect(charge!.y+charge!.height).toBeLessThanOrEqual(tabs!.y);
        await expect(page.getByRole('tab',{selected:true}).locator('..').getByRole('button',{name:/Cerrar/})).toBeInViewport();
        await expect(page.getByRole('button',{name:'+ Nuevo pedido',exact:true})).toBeInViewport();
      }
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.screenshot({path:`${root}/${viewport.name}-${dark?'dark':'light'}.png`});
      if(viewport.width>800)await page.locator('#pos-main').evaluate(el=>el.scrollTop=0);
      if(viewport.width<=800){
        await page.getByRole('button',{name:'Pedido (12)',exact:true}).click();
        await expect(page.getByRole('region',{name:'Pedido'})).toBeVisible();
        await page.screenshot({path:`${root}/mobile-order-${dark?'dark':'light'}.png`});
        await page.getByRole('button',{name:'Productos',exact:true}).click();
      }
    }
  }
  await page.getByRole('button',{name:'Cobrar',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('Buscar cliente', {exact:true})).toBeFocused();
  await expect(dialog.getByLabel(/Cantidad a cobrar/)).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Confirmar cobro'})).toBeInViewport();
  await dialog.getByLabel('Propina voluntaria').fill('1000');
  await expect(dialog.getByLabel('Importe 1 (COP)')).toHaveValue('60000');
  await expect(dialog.locator('.checkout-summary')).toContainText('1.000');
  await dialog.getByRole('button',{name:'Importe exacto',exact:true}).click();
  await expect(dialog.getByLabel('Importe 1 (COP)')).toHaveValue('61000');
  await dialog.getByRole('button',{name:'Dividir cuenta',exact:true}).click();
  await expect(dialog.getByLabel(/Cantidad a cobrar/)).toHaveCount(12);
  await dialog.locator('fieldset').evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(dialog.getByRole('button',{name:'Confirmar cobro'})).toBeInViewport();
  for(const width of [390,1366]){
    await page.setViewportSize({width,height:768});
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
    await page.screenshot({path:`${root}/checkout-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Cobrar',exact:true})).toBeFocused();
  await page.setViewportSize({width:1366,height:768});
  // Restore original order; unprepared cancellation leaves shift totals unchanged.
  await page.getByRole('tab',{selected:true}).locator('..').getByRole('button',{name:/Cerrar/}).click();
  await dialog.getByLabel('Motivo',{exact:true}).fill('Fin de revisión UI sintética');
  await dialog.getByRole('button',{name:'Confirmar cancelación'}).click();
  await expect(dialog).not.toBeVisible();
  await page.locator(`[role="tab"][data-order-id="${initialOrder}"]`).click();
}
