async(page)=>{
  const output='output/playwright/visual-redesign/';
  await page.emulateMedia({media:'print'});
  const print=await page.locator('.thermal-receipt').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  if(print.background!=='rgb(255, 255, 255)'||print.color!=='rgb(0, 0, 0)')throw new Error('Receipt contrast');
  await page.screenshot({path:output+'real-thermal-print.png',fullPage:true});
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Cerrar formulario',exact:true}).click();
  await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await page.getByText('0 pendientes',{exact:true}).waitFor();
  await page.context().setOffline(true);
  let offline;
  try {
    await page.reload();
    await page.getByRole('heading',{name:'Nueva venta',exact:true}).waitFor();
    offline=await page.evaluate(async()=>{await document.fonts.ready;const keys=await caches.keys();const assets=(await Promise.all(keys.map(async key=>(await(await caches.open(key)).keys()).map(r=>r.url)))).flat();return {font:document.fonts.check('14px "Inter Variable"'),cachedFont:assets.some(url=>url.includes('inter-latin')&&url.endsWith('.woff2')),externalAssets:assets.filter(url=>!url.startsWith(location.origin))};});
    if(!offline.font||!offline.cachedFont||offline.externalAssets.length)throw new Error('Offline assets not local');
    await page.screenshot({path:output+'real-pos-offline.png'});
  } finally {await page.context().setOffline(false);}
  await page.getByRole('link',{name:'Administración',exact:true}).click();
  await page.getByTestId('sales-today').filter({hasText:'63.000'}).waitFor();
  return {print,offline,confirmedProducts:'63000',tipExcluded:true};
}
