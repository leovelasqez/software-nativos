import { expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function exerciseCajaUi(page: Page) {
  const root = 'test-results/caja-ui';
  await mkdir(root, {recursive:true});
  const initialOrder = await page.getByLabel('Pedido abierto').inputValue();
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
        const charge=page.getByRole('button',{name:'Cobrar pedido',exact:true});await expect(charge).toBeInViewport();
        await page.locator('.pos-products').evaluate(el=>el.scrollTop=el.scrollHeight);
        await page.locator('.pos-order-lines').evaluate(el=>el.scrollTop=el.scrollHeight);
        await expect(charge).toBeInViewport();
      } else {
        await expect(search).toBeInViewport();await expect(page.getByRole('button',{name:'Cobrar',exact:true})).toBeInViewport();
      }
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.screenshot({path:`${root}/${viewport.name}-${dark?'dark':'light'}.png`});
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
  await page.getByRole('button',{name:'Cancelar venta',exact:true}).click();
  await dialog.getByLabel('Motivo',{exact:true}).fill('Fin de revisión UI sintética');
  await dialog.getByRole('button',{name:'Confirmar cancelación'}).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Pedido abierto').selectOption(initialOrder);
}
