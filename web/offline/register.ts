if('serviceWorker'in navigator){
 let requested=false;
 const emptyLogin=()=>Boolean(document.querySelector('.auth-shell'))
  && !document.querySelector('.auth-shell fieldset[disabled]')
  && !Array.from(document.querySelectorAll<HTMLInputElement>('.auth-shell input')).some(input=>Boolean(input.value));
 const activateLogin=(registration:ServiceWorkerRegistration)=>{
  if(registration.waiting&&emptyLogin()){
   requested=true;registration.waiting.postMessage({type:'nativos-login-update'});
  }
 };
 const registration=navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
 void registration.then(value=>{
  activateLogin(value);
  value.addEventListener('updatefound',()=>value.installing?.addEventListener('statechange',()=>activateLogin(value)));
 }).catch(()=>{});
 window.addEventListener('nativos-login-ready',()=>void registration.then(activateLogin).catch(()=>{}));
 window.addEventListener('focus',()=>void registration.then(async value=>{await value.update();activateLogin(value);}).catch(()=>{}));
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='nativos-check-login'&&event.ports[0]){
   event.ports[0].postMessage({ready:emptyLogin()});event.ports[0].close();
  }
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requested&&emptyLogin())window.location.reload();});
}

window.addEventListener('storage',e=>{if(e.key==='nativos-session-ended')window.dispatchEvent(new Event('session-expired'));});
