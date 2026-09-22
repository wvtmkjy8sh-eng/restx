const C='restx-v11';
const A=[
  './','./index.html','./style.css','./app.js','./manifest.json',
  './assets_bg.jpg','./restx-alert.wav','./restx-keepalive.wav','./icons/icon-192.svg','./icons/icon-512.svg'
];

let timerId=0;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const dest=e.request.destination;
  const live=e.request.mode==='navigate'||dest==='document'||dest==='script'||dest==='style';
  if(live){
    e.respondWith(
      fetch(e.request).then(res=>{
        if(res&&res.ok){
          const copy=res.clone();
          caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>caches.match(e.request).then(x=>x||caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(x=>x||fetch(e.request).then(res=>{
      if(res&&res.ok){
        const copy=res.clone();
        caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});
      }
      return res;
    }))
  );
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
    self.registration.getNotifications().then(list=>{
      list.forEach(n=>{
        if(n.tag==='restx-rest-scheduled')n.close();
      });
    }).catch(()=>{});
    return;
  }
  if(d.type==='ARM_TIMER'){
    if(timerId)clearTimeout(timerId);
    const endAt=Number(d.endAt);
    const delay=Math.max(0,endAt-Date.now()+80);
    timerId=setTimeout(()=>{
      timerId=0;
      showFinishNotification(
        d.title||'RestX — descanso finalizado',
        d.body||'Seu descanso terminou. Próximo exercício.',
        d.url||'./'
      );
    },Math.min(delay,2147483647));
    scheduleTimestampNotification(
      endAt,
      d.title||'RestX — descanso finalizado',
      d.body||'Seu descanso terminou. Próximo exercício.',
      d.url||'./'
    );
  }
  if(d.type==='SHOW_FINISH_NOTIFICATION'){
    showFinishNotification(
      d.title||'RestX — descanso finalizado',
      d.options?.body||'Seu descanso terminou. Próximo exercício.',
      d.options?.data?.url||'./'
    );
  }
});

async function scheduleTimestampNotification(endAt,title,body,url){
  if(typeof TimestampTrigger==='undefined')return;
  try{
    const old=await self.registration.getNotifications({tag:'restx-rest-scheduled'});
    old.forEach(n=>n.close());
    if(endAt<=Date.now())return;
    await self.registration.showNotification(title,{
      body,
      tag:'restx-rest-scheduled',
      icon:'./icons/icon-192.svg',
      badge:'./icons/icon-192.svg',
      vibrate:[400,100,400,100,700],
      silent:false,
      data:{url},
      showTrigger:new TimestampTrigger(endAt)
    });
  }catch(e){}
}

async function showFinishNotification(title,body,url){
  try{
    await self.registration.showNotification(title,{
      body,
      tag:'restx-rest-finished',
      renotify:true,
      requireInteraction:true,
      silent:false,
      sound:'./restx-alert.wav',
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
