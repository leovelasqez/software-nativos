if('serviceWorker'in navigator){void navigator.serviceWorker.register('/sw.js').catch(()=>{});}

window.addEventListener('storage',e=>{if(e.key==='nativos-session-ended')window.dispatchEvent(new Event('session-expired'));});
