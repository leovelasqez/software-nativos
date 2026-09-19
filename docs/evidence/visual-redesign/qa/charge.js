async(page)=>{
  const output='output/playwright/visual-redesign/';
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Propina voluntaria',{exact:true}).fill('1000');
  await dialog.getByRole('button',{name:'Importe exacto',exact:true}).click();
  if(await dialog.getByLabel('Importe 1 (COP)',{exact:true}).inputValue()!=='64000')throw new Error('Payment total');
  for(const width of [1366,390]){
    await page.setViewportSize({width,height:768});
    await page.screenshot({path:output+`real-charge-${width}-dark.png`});
    const box=await dialog.getByRole('button',{name:'Confirmar cobro',exact:true}).boundingBox();
    if(!box||box.y<0||box.y+box.height>768)throw new Error('Charge confirmation outside viewport');
  }
  await page.setViewportSize({width:1366,height:768});
  await dialog.getByRole('button',{name:'Confirmar cobro',exact:true}).click();
  await page.locator('.checkout-dialog').waitFor({state:'hidden'});
  await page.locator('.thermal-receipt').waitFor();
  await page.emulateMedia({media:'print'});
  const print=await page.locator('.thermal-receipt').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  if(print.background!=='rgb(255, 255, 255)'||print.color!=='rgb(0, 0, 0)')throw new Error('Receipt contrast');
  await page.screenshot({path:output+'real-thermal-print.png',fullPage:true});
  await page.emulateMedia({media:'screen'});
  return {syntheticSale:'64000',products:'63000',tip:'1000',print};
}
