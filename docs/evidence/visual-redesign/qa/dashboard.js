async(page)=>{
  const checks=[];const check=(name,ok)=>{if(!ok)throw new Error(name);checks.push(name);};
  const select=page.getByRole('combobox',{name:'Sucursal',exact:true});
  const metric=page.getByTestId('sales-today');
  await metric.filter({hasText:'63.000'}).waitFor();
  check('Products exclude 1000 tip',(await page.getByTestId('sales-month').innerText()).includes('63.000'));
  check('Ticket average',(await page.getByTestId('ticket-average').innerText()).includes('63.000'));
  check('Top 5',await page.locator('.product-ranking tbody tr').count()===5);
  await select.selectOption('milan');await metric.filter({hasText:'$ 0'}).waitFor();
  check('Empty branch ticket',(await page.getByTestId('ticket-average').innerText())==='—');
  check('Empty branch ranking',await page.locator('.product-ranking tbody tr').count()===0);
  check('Empty branch alerts',(await page.getByTestId('stock-alert-count').innerText())==='0');
  await select.selectOption('centro');await metric.filter({hasText:'63.000'}).waitFor();
  let started,release,done;
  const start=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve),finished=new Promise(resolve=>done=resolve);
  const handler=async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response});done();};
  await page.route('**/api/dashboard?branchId=milan',handler);
  await select.selectOption('milan');await start;
  check('Loading state is explicit',await page.getByRole('status').filter({hasText:'Consultando ventas'}).isVisible());
  await select.selectOption('centro');await metric.filter({hasText:'63.000'}).waitFor();
  release();await finished;await page.waitForTimeout(120);
  check('Late branch response ignored',(await metric.innerText()).includes('63.000'));
  await page.unroute('**/api/dashboard?branchId=milan',handler);
  const failure=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fallo de consulta simulado para AC-017'})});
  await page.route('**/api/dashboard?branchId=centro',failure);
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Fallo de consulta simulado'}).waitFor();
  check('Error does not display false zero',await metric.count()===0);
  await page.unroute('**/api/dashboard?branchId=centro',failure);
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();await metric.filter({hasText:'63.000'}).waitFor();
  check('Refresh recovers',true);
  const target=await page.evaluate(async()=>{
    const call=async(path,method='GET',data)=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-Nativos-Request':'1'},...(data?{body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok)throw new Error(b.message);return b;};
    const detail=await call('/branches/centro');
    if(!detail.warehouses.some(w=>w.name==='Bodega revisión alertas'))await call('/branches/centro/warehouses','POST',{name:'Bodega revisión alertas',reason:'AC-017 bodega sintética',isDefault:false});
    const branch=await call('/branches/centro');const warehouse=branch.warehouses.find(w=>w.name==='Bodega revisión alertas');
    const products=await call('/products?branchId=centro&limit=100');const item=products.items.find(p=>p.name==='Granola artesanal');
    await call('/warehouses/'+warehouse.id+'/minimum','PUT',{branchId:'centro',operationId:crypto.randomUUID(),reason:'AC-017 mínimo sintético',itemId:item.id,minimum:'5'});
    return warehouse.id;
  });
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByTestId('stock-alert-count').filter({hasText:'4'}).waitFor();
  await page.locator('.stock-alert-row').filter({hasText:'Bodega revisión alertas'}).click();
  await page.getByRole('combobox',{name:'Bodega',exact:true}).locator('option[value="'+target+'"]').waitFor({state:'attached'});
  check('Alert opens correct warehouse',await page.getByRole('combobox',{name:'Bodega',exact:true}).inputValue()===target);
  await page.getByRole('navigation').getByRole('button',{name:'Resumen',exact:true}).click();await metric.waitFor();
  for(const width of [1366,390,320]){
    await page.setViewportSize({width,height:width===1366?768:844});
    for(const dark of [false,true]){
      const toggle=page.getByRole('switch',{name:'Modo oscuro'});if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();
      check('Populated dashboard fits '+width+'/'+dark,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:'output/playwright/visual-redesign/real-summary-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
    }
  }
  await page.setViewportSize({width:1366,height:768});
  return {checks:checks.length,names:checks};
}
