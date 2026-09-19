async(page)=>{
  const output='output/playwright/visual-redesign/';
  const names=['Resumen','Sucursales y bodegas','Productos','Recetas','Inventario','Compras y proveedores','Traslados','Conteos y ajustes','Clientes','Fidelización','Informes','Usuarios y roles','Auditoría','Notificaciones','Respaldo y recuperación'];
  const checked=[];
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1366,390,320]) {
    await page.setViewportSize({width,height:width===1366?768:844});
    for(const name of names) {
      if(width<=800)await page.getByRole('button',{name:'Mostrar navegación',exact:true}).click();
      await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
      if(name==='Resumen')await page.getByTestId('sales-today').waitFor();
      else await page.getByRole('heading',{name,exact:true,level:1}).waitFor();
      await page.waitForTimeout(180);
      for(const dark of [false,true]) {
        const toggle=page.getByRole('switch',{name:'Modo oscuro'});
        if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();
        const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,bg:getComputedStyle(document.body).backgroundColor}));
        if(dimensions.scroll>width)throw new Error(name+' overflow '+width+' '+dimensions.scroll);
        if(dark && dimensions.bg!=='rgb(23, 24, 28)')throw new Error('Dark is not charcoal');
        if(width!==320)await page.screenshot({path:output+`real-module-${names.indexOf(name)}-${width}-${dark?'dark':'light'}.png`,fullPage:name==='Resumen'});
        checked.push(`${name}/${width}/${dark?'dark':'light'}`);
      }
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('navigation').getByRole('button',{name:'Resumen',exact:true}).click();
  await page.getByTestId('sales-today').waitFor();
  if(errors.length)throw new Error(errors.join('; '));
  return {checked:checked.length,errors,font:await page.evaluate(async()=>{await document.fonts.ready;return {family:getComputedStyle(document.body).fontFamily,loaded:document.fonts.check('14px "Inter Variable"')}})};
}
