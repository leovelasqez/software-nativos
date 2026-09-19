async(page)=>{
  await page.context().addInitScript({path:'node_modules/axe-core/axe.min.js'});
  await page.reload();await page.getByTestId('sales-today').waitFor();
  const names=['Resumen','Sucursales y bodegas','Productos','Recetas','Inventario','Compras y proveedores','Traslados','Conteos y ajustes','Clientes','Fidelización','Informes','Usuarios y roles','Auditoría','Notificaciones','Respaldo y recuperación'];
  const results=[];
  for(const width of [1366,390]){
    await page.setViewportSize({width,height:768});
    for(const name of names){
      if(width<800)await page.getByRole('button',{name:'Mostrar navegación',exact:true}).click();
      await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
      if(name==='Resumen')await page.getByTestId('sales-today').waitFor();else await page.getByRole('heading',{name,exact:true,level:1}).waitFor();
      await page.waitForTimeout(100);
      for(const dark of [false,true]){
        const toggle=page.getByRole('switch',{name:'Modo oscuro'});if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();
        const violations=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
        if(violations.length)throw new Error(name+'/'+width+'/'+dark+': '+JSON.stringify(violations));
        results.push(name+'/'+width+'/'+dark);
      }
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('navigation').getByRole('button',{name:'Resumen',exact:true}).click();
  await page.getByTestId('sales-today').waitFor();
  return {axeAudits:results.length,violations:0};
}
