async (page) => {
  const output='output/playwright/visual-redesign/';
  const results=[];
  for(const width of [1366,390,320]) {
    await page.setViewportSize({width,height:768});
    for(const dark of [false,true]) {
      const toggle=page.getByRole('switch',{name:'Modo oscuro'});
      if(await toggle.getAttribute('aria-checked')!==String(dark)) await toggle.click();
      await page.screenshot({path:output+`real-login-${width}-${dark?'dark':'light'}.png`,fullPage:true});
      if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Login overflow '+width);
    }
  }
  await page.setViewportSize({width:1366,height:768});
  const password=await page.evaluate(()=>{const p=crypto.randomUUID()+crypto.randomUUID();sessionStorage.setItem('synthetic-review-password',p);return p;});
  await page.getByLabel('Nombre completo').fill('Equipo de revisión');
  await page.getByLabel('Usuario',{exact:true}).fill('review-owner');
  await page.getByLabel('Contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Crear mi acceso',exact:true}).click();
  await page.getByTestId('sales-today').waitFor();
  const items=await page.evaluate(async()=>{
    const call=async(path,method,data)=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-Nativos-Request':'1'},body:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw new Error(body.message);return body;};
    const common=()=>({branchId:'centro',operationId:crypto.randomUUID(),reason:'AC-017 revisión visual con datos sintéticos'});
    const products=[];
    const names=['Granola artesanal','Yogur natural','Galletas de avena','Jugo verde','Tostada integral'];
    for(let i=0;i<18;i++)products.push(await call('/products','POST',{...common(),name:i<5?names[i]:`Producto de revisión ${i+1}`,reference:'REV-'+i,type:'finished',category:i%2?'Bebidas':'Alimentos',presentation:'Unidad',unit:'unit',price:String(4000+i*500),tax:null,description:'Producto sintético de revisión visual'}));
    for(let i=0;i<3;i++)await call('/warehouses/centro-venta/minimum','PUT',{...common(),itemId:products[i].id,minimum:'5'});
    return products.map(p=>({id:p.id,name:p.name}));
  });
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();
  await page.getByTestId('stock-alert-count').filter({hasText:'3'}).waitFor();
  console.log(JSON.stringify({setup:true,syntheticProducts:items.length,font:await page.evaluate(async()=>{await document.fonts.ready;return {family:getComputedStyle(document.body).fontFamily,loaded:document.fonts.check('14px "Inter Variable"')}})}));
}
