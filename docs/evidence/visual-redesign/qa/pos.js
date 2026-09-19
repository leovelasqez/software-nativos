async(page)=>{
  const output='output/playwright/visual-redesign/';
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Cantidad',{exact:true}).fill('2');
  await dialog.getByRole('button',{name:'Guardar en pedido',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  for(const name of ['Yogur natural','Galletas de avena','Jugo verde','Tostada integral','Producto de revisión 6']){
    await page.locator('.pos-product').filter({has:page.getByText(name,{exact:true})}).click();
    await dialog.getByLabel('Cantidad',{exact:true}).fill('2');
    await dialog.getByRole('button',{name:'Guardar en pedido',exact:true}).click();await dialog.waitFor({state:'hidden'});
  }
  const checked=[];
  for(const width of [1366,1024]){
    await page.setViewportSize({width,height:768});
    for(const dark of [false,true]){
      const toggle=page.getByRole('switch',{name:'Modo oscuro'});if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();
      await page.locator('.pos-products').evaluate(el=>el.scrollTop=0);
      await page.locator('.pos-order-lines').evaluate(el=>el.scrollTop=0);
      const overflow=await page.locator('.pos-product').evaluateAll(cards=>cards.filter(el=>[...el.querySelectorAll('strong,b,small,span:not(.product-add)')].some(child=>child.getBoundingClientRect().bottom>el.getBoundingClientRect().bottom+1)).map(el=>el.textContent));
      if(overflow.length)throw new Error('Product card overflow: '+overflow.join(';'));
      const charge=page.getByRole('button',{name:'Cobrar pedido',exact:true});
      const box=await charge.boundingBox();if(!box||box.y<0||box.y+box.height>768)throw new Error('Charge outside viewport');
      if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('POS horizontal overflow');
      await page.screenshot({path:output+`real-pos-${width}-${dark?'dark':'light'}.png`});checked.push(`${width}/${dark}`);
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('button',{name:'Cobrar pedido',exact:true}).click();
  return {checked};
}
