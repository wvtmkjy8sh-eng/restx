const C='restx-v2';
const A=[
  './','./index.html','./style.css','./app.js','./manifest.json',
  './assets_bg.svg','./restx-alert.wav','./icons/icon-192.svg','./icons/icon-512.svg'
];

let timerId=0;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request)));
});

self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(d.type==='CANCEL_TIMER'){
    if(timerId)clearTimeout(timerId);
    timerId=0;
    return;
  }
  if(d.type==='ARM_TIMER'){
    if(timerId)clearTimeout(timerId);
    const delay=Math.max(0,Number(d.endAt)-Date.now()+80);
    timerId=setTimeout(()=>{
      timerId=0;
      showFinishNotification(
        d.title||'RestX — descanso finalizado',
        d.body||'Seu descanso terminou. Próximo exercício.',
        d.url||'./'
      );
    },Math.min(delay,2147483647));
  }
  if(d.type==='SHOW_FINISH_NOTIFICATION'){
    showFinishNotification(
      d.title||'RestX — descanso finalizado',
      d.options?.body||'Seu descanso terminou. Próximo exercício.',
      d.options?.data?.url||'./'
    );
  }
});

async function showFinishNotification(title,body,url){
  try{
    await self.registration.showNotification(title,{
      body,
      tag:'restx-rest-finished',
      renotify:true,
      icon:'./icons/icon-192.svg',
      badge:'./icons/icon-192.svg',
      vibrate:[400,100,400,100,700],
      data:{url}
    });
  }catch(e){}
}

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if('focus'in client)return client.focus();
      }
      if(clients.openWindow)return clients.openWindow('./');
    })
  );
});
