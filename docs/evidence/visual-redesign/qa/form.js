async(page)=>{
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('navigation').getByRole('button',{name:'Productos',exact:true}).click();
  const button=page.getByRole('button',{name:'+ Nuevo producto',exact:true});
  await button.waitFor();
  const checks=[];
  for(const width of [1366,390]){
    await page.setViewportSize({width,height:768});
    for(const dark of [false,true]){
      const toggle=page.getByRole('switch',{name:'Modo oscuro'});if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();
      await button.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
      if(!await dialog.evaluate(el=>el.contains(document.activeElement)))throw new Error('Focus escaped dialog');
      await page.keyboard.press('Tab');
      if(!await dialog.evaluate(el=>el.contains(document.activeElement)))throw new Error('Keyboard focus escaped dialog');
      if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Form overflow');
      const violations=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(v=>v.id);});
      if(violations.length)throw new Error(violations.join(','));
      await page.screenshot({path:'output/playwright/visual-redesign/real-product-form-'+width+'-'+(dark?'dark':'light')+'.png'});
      await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      if(!await button.evaluate(el=>el===document.activeElement))throw new Error('Focus not returned');
      checks.push(width+'/'+dark);
    }
  }
  return {keyboardAndAxe:checks.length};
}
