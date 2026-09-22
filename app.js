import('./style.css').catch(()=>{});

const $=s=>document.querySelector(s),
minutes=$('#minutes'),seconds=$('#seconds'),ring=$('#ring'),
statusEl=$('#status'),done=$('#done'),app=document.querySelector('.app'),
startBtn=$('#start'),startText=$('#startText'),startIcon=$('#startIcon'),
alertAudio=$('#restxAlertAudio'),alertKeep=$('#restxKeepAliveAudio');

const R=132,C=2*Math.PI*R;
if(ring)ring.style.strokeDasharray=C;

let selected=60,remaining=60,running=false,last=0,raf=0,audioCtx=null,installPrompt=null;
let endAt=0, backgroundFinishTimer=0, resumeWatch=0, beepHold=0;
let keepAliveNode=null, pendingBeep=false, nativeApi=null, wakeLock=null;

const TIMER_KEY='restx_timer_state_v2';

function format(v){
  v=Math.max(0,Math.ceil(v));
  minutes.textContent=String(Math.floor(v/60)).padStart(2,'0');
  seconds.textContent=String(v%60).padStart(2,'0');
}
function render(){
  format(remaining);
  ring.style.strokeDashoffset=C*(1-(selected?remaining/selected:0));
  statusEl.textContent=running?'DESCANSANDO':'PRONTO';
}
function state(){
  startBtn.disabled=running;
  startText.textContent='Iniciar';
  startIcon.innerHTML='<path d="M8 6.5v11l10-5.5-10-5.5Z"/>';
}
function prepAudioEl(el){
  if(!el)return;
  el.playsInline=true;
  el.setAttribute('playsinline','');
  el.setAttribute('webkit-playsinline','');
  el.preload='auto';
  el.muted=false;
}
function armAudioSession(){
  try{
    if('audioSession' in navigator)navigator.audioSession.type='playback';
  }catch(e){}
}
function unlockAudio(){
  try{
    armAudioSession();
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    prepAudioEl(alertAudio);
    prepAudioEl(alertKeep);
    if(alertAudio){
      alertAudio.loop=false;
      alertAudio.muted=true;
      alertAudio.volume=0;
      const p=alertAudio.play();
      if(p&&p.then)p.then(()=>{
        alertAudio.pause();
        try{alertAudio.currentTime=0}catch(e){}
        alertAudio.muted=false;
        alertAudio.volume=1;
      }).catch(()=>{});
    }
    if(alertKeep){
      alertKeep.loop=true;
      alertKeep.muted=false;
      alertKeep.volume=1;
      alertKeep.play().catch(()=>{});
    }
  }catch(e){}
}
function markNowPlaying(){
  if(!navigator.mediaSession)return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:'RestX',
      artist:'Descansando',
      album:'Rest Timer'
    });
    navigator.mediaSession.playbackState='playing';
    navigator.mediaSession.setActionHandler('play',()=>{
      alertKeep?.play().catch(()=>{});
      if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    });
    navigator.mediaSession.setActionHandler('pause',()=>{
      alertKeep?.play().catch(()=>{});
      if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    });
  }catch(e){}
}
function startKeepAlive(){
  unlockAudio();
  markNowPlaying();
  try{
    if(alertKeep){
      alertKeep.loop=true;
      alertKeep.muted=false;
      alertKeep.volume=1;
      alertKeep.play().catch(()=>{});
    }
  }catch(e){}
  if(!resumeWatch){
    resumeWatch=setInterval(()=>{
      if(!running)return;
      armAudioSession();
      if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
      if(alertKeep&&alertKeep.paused)alertKeep.play().catch(()=>{});
    },4000);
  }
  if(navigator.wakeLock){
    navigator.wakeLock.request('screen').then(lock=>{
      wakeLock=lock;
    }).catch(()=>{});
  }
}
function stopKeepAlive(){
  if(resumeWatch){clearInterval(resumeWatch);resumeWatch=0}
  try{keepAliveNode?.o.stop()}catch(e){}
  keepAliveNode=null;
  try{
    if(alertKeep){
      alertKeep.pause();
      alertKeep.currentTime=0;
    }
  }catch(e){}
  try{wakeLock?.release()}catch(e){}
  wakeLock=null;
  if(beepHold)return;
  try{
    if(navigator.mediaSession)navigator.mediaSession.playbackState='none';
  }catch(e){}
}
function fallback(){
  try{
    armAudioSession();
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    const kick=audioCtx.state==='suspended'?audioCtx.resume():Promise.resolve();
    const play=()=>{
      if(!audioCtx)return;
      let n=audioCtx.currentTime;
      [{s:0,d:.12,f:3200},{s:.2,d:.12,f:3200},{s:.4,d:.12,f:3200},{s:.6,d:.16,f:3600}].forEach(p=>{
        let o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='square';
        o.frequency.setValueAtTime(p.f,n+p.s);
        g.gain.setValueAtTime(.0001,n+p.s);
        g.gain.linearRampToValueAtTime(.95,n+p.s+.008);
        g.gain.setValueAtTime(.95,n+p.s+p.d-.02);
        g.gain.linearRampToValueAtTime(.0001,n+p.s+p.d);
        o.connect(g);g.connect(audioCtx.destination);
        o.start(n+p.s);o.stop(n+p.s+p.d+.01);
      });
    };
    if(kick&&kick.then)kick.then(play).catch(play);else play();
  }catch(e){}
}
function beep(){
  pendingBeep=false;
  beepHold=1;
  try{
    armAudioSession();
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    prepAudioEl(alertAudio);
    if(alertAudio){
      try{alertAudio.pause()}catch(e){}
      alertAudio.muted=false;
      alertAudio.loop=false;
      alertAudio.volume=1;
      try{alertAudio.currentTime=0}catch(e){}
      const p=alertAudio.play();
      if(p&&p.catch)p.catch(fallback);
    }else fallback();
    if(navigator.vibrate)navigator.vibrate([180,80,180,80,280]);
  }catch(e){fallback()}
  setTimeout(()=>{
    beepHold=0;
    if(!running){
      try{
        if(navigator.mediaSession)navigator.mediaSession.playbackState='none';
      }catch(e){}
    }
  },2600);
}


const NATIVE_NOTIFICATION_ID=9001001;
const NATIVE_CHANNEL_ID='restx-rest';
let nativeNotificationsReady=false;

async function loadNative(){
  if(nativeApi!==null)return nativeApi;
  nativeApi=false;
  try{
    const core=await import('@capacitor/core');
    if(!core.Capacitor?.isNativePlatform())return false;
    const notes=await import('@capacitor/local-notifications');
    nativeApi={Capacitor:core.Capacitor,LocalNotifications:notes.LocalNotifications};
    return nativeApi;
  }catch(e){
    return false;
  }
}

function isNativeApp(){
  return !!(nativeApi&&nativeApi.Capacitor);
}

async function setupNativeNotifications(){
  const api=await loadNative();
  if(!api)return false;
  try{
    let perm=await api.LocalNotifications.checkPermissions();
    if(perm.display!=='granted'){
      perm=await api.LocalNotifications.requestPermissions();
    }
    if(perm.display!=='granted')return false;
    if(api.Capacitor.getPlatform()==='android'){
      try{
        await api.LocalNotifications.createChannel({
          id:NATIVE_CHANNEL_ID,
          name:'RestX — descanso',
          description:'Alertas do fim do descanso',
          sound:'restx_alert',
          importance:5,
          vibration:true,
          lights:true,
          lightColor:'#B8FF3D'
        });
      }catch(e){}
    }
    nativeNotificationsReady=true;
    return true;
  }catch(e){
    return false;
  }
}

async function scheduleNativeFinish(endTimestamp){
  const api=await loadNative();
  if(!api)return false;
  try{
    if(!nativeNotificationsReady && !(await setupNativeNotifications()))return false;
    await api.LocalNotifications.cancel({notifications:[{id:NATIVE_NOTIFICATION_ID}]});
  }catch(e){}
  try{
    const at=new Date(endTimestamp);
    if(at.getTime()<=Date.now())return false;
    await api.LocalNotifications.schedule({
      notifications:[{
        id:NATIVE_NOTIFICATION_ID,
        title:'RestX — descanso finalizado',
        body:'Seu descanso terminou. Próximo exercício.',
        schedule:{
          at,
          allowWhileIdle:true
        },
        sound:'restx_alert',
        channelId:NATIVE_CHANNEL_ID,
        extra:{type:'restx-finish'}
      }]
    });
    return true;
  }catch(e){
    console.warn('RestX native notification schedule failed',e);
    return false;
  }
}

async function cancelNativeFinish(){
  const api=nativeApi||await loadNative();
  if(!api)return;
  try{
    await api.LocalNotifications.cancel({notifications:[{id:NATIVE_NOTIFICATION_ID}]});
  }catch(e){}
}

async function enableNotifications(){
  if(await loadNative()) return setupNativeNotifications();
  if(!('Notification' in window))return false;
  if(Notification.permission==='granted')return true;
  if(Notification.permission==='denied')return false;
  try{return await Notification.requestPermission()==='granted'}catch(e){return false}
}
function notifyFinish(){
  const title='RestX — descanso finalizado';
  const options={
    body:'Seu descanso terminou. Próximo exercício.',
    tag:'restx-rest-finished',
    renotify:true,
    requireInteraction:true,
    silent:false,
    sound:'./restx-alert.wav',
    icon:'./icons/icon-192.svg',
    badge:'./icons/icon-192.svg',
    vibrate:[400,100,400,100,700],
    data:{url:'./'}
  };
  try{
    if(navigator.serviceWorker){
      navigator.serviceWorker.ready.then(reg=>{
        if(reg.showNotification)return reg.showNotification(title,options);
        if(reg.active)reg.active.postMessage({type:'SHOW_FINISH_NOTIFICATION',title,options});
      }).catch(()=>{});
    }
  }catch(e){}
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification(title,options);
    }
  }catch(e){}
}
function saveTimer(){
  if(!running){
    localStorage.removeItem(TIMER_KEY);
    return;
  }
  localStorage.setItem(TIMER_KEY,JSON.stringify({
    running:true,selected,endAt,updatedAt:Date.now()
  }));
}
function clearBackgroundTimer(){
  if(backgroundFinishTimer){
    clearTimeout(backgroundFinishTimer);
    backgroundFinishTimer=0;
  }
}
function armBackgroundTimer(){
  clearBackgroundTimer();
  if(!running||!endAt)return;
  const delay=Math.max(0,endAt-Date.now()+80);
  backgroundFinishTimer=setTimeout(()=>{
    if(running&&Date.now()>=endAt)finish();
  },Math.min(delay,2147483647));
  try{
    navigator.serviceWorker?.controller?.postMessage({
      type:'ARM_TIMER',
      endAt,
      title:'RestX — descanso finalizado',
      body:'Seu descanso terminou. Próximo exercício.',
      url:'./'
    });
  }catch(e){}
}
function syncFromClock(){
  if(!running||!endAt)return;
  const left=Math.max(0,(endAt-Date.now())/1000);
  remaining=left;
  if(left<=0){
    finish();
  }else{
    render();
  }
}
function start(){
  if(running)return;
  if(remaining<=0)remaining=selected;
  try{navigator.vibrate&&navigator.vibrate(0)}catch(e){}
  unlockAudio();
  startKeepAlive();
  enableNotifications();
  running=true;
  endAt=Date.now()+Math.max(0,remaining*1000);
  last=performance.now();
  done.classList.remove('show');
  app.classList.remove('finished');
  state();render();saveTimer();armBackgroundTimer();
  scheduleNativeFinish(endAt);
  raf=requestAnimationFrame(tick);
}
function reset(){
  running=false;
  endAt=0;
  pendingBeep=false;
  stopKeepAlive();
  clearBackgroundTimer();
  cancelAnimationFrame(raf);
  remaining=selected;
  done.classList.remove('show');
  app.classList.remove('finished');
  state();render();saveTimer();
  cancelNativeFinish();
  try{navigator.serviceWorker?.controller?.postMessage({type:'CANCEL_TIMER'})}catch(e){}
}
function choose(v){
  selected=v;remaining=v;running=false;endAt=0;
  pendingBeep=false;
  stopKeepAlive();
  clearBackgroundTimer();
  cancelAnimationFrame(raf);
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',+b.dataset.time===v));
  done.classList.remove('show');
  app.classList.remove('finished');
  state();render();saveTimer();
  cancelNativeFinish();
  try{navigator.serviceWorker?.controller?.postMessage({type:'CANCEL_TIMER'})}catch(e){}
}
function adjust(d){choose(Math.min(3600,Math.max(5,selected+d)))}
function finish(){
  if(!running)return;
  running=false;endAt=0;
  clearBackgroundTimer();
  cancelAnimationFrame(raf);
  remaining=0;
  render();state();
  app.classList.add('finished');
  done.classList.add('show');
  saveTimer();
  cancelNativeFinish();
  try{navigator.serviceWorker?.controller?.postMessage({type:'CANCEL_TIMER'})}catch(e){}
  if(document.visibilityState==='hidden')pendingBeep=true;
  notifyFinish();
  beep();
  setTimeout(stopKeepAlive,2600);
  setTimeout(()=>{
    remaining=selected;
    render();
    done.classList.remove('show');
    app.classList.remove('finished');
  },2800);
}
function tick(t){
  if(!running)return;
  syncFromClock();
  if(!running)return;
  last=t;
  raf=requestAnimationFrame(tick);
}

async function restoreTimer(){
  try{
    const saved=JSON.parse(localStorage.getItem(TIMER_KEY)||'null');
    if(!saved?.running||!saved.endAt)return;
    selected=Math.min(3600,Math.max(5,Number(saved.selected)||60));
    remaining=Math.max(0,(Number(saved.endAt)-Date.now())/1000);
    if(remaining<=0){
      running=true;
      endAt=Number(saved.endAt);
      finish();
      return;
    }
    running=true;
    endAt=Number(saved.endAt);
    document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',+b.dataset.time===selected));
    state();render();armBackgroundTimer();
    startKeepAlive();
    scheduleNativeFinish(endAt);
    raf=requestAnimationFrame(tick);
  }catch(e){
    localStorage.removeItem(TIMER_KEY);
  }
}

function bindTap(el,fn){
  if(!el)return;
  el.addEventListener('click',e=>{
    e.preventDefault();
    fn(e);
  });
}

bindTap($('#start'),start);
bindTap($('#reset'),reset);
bindTap($('#minus'),()=>adjust(-5));
bindTap($('#plus'),()=>adjust(5));
document.querySelectorAll('.preset').forEach(b=>bindTap(b,()=>choose(+b.dataset.time)));
addEventListener('pointerdown',unlockAudio,{once:true,passive:true});

addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    armAudioSession();
    if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    syncFromClock();
    if(pendingBeep||(remaining<=0&&!running&&done.classList.contains('show')))beep();
    if(running){
      startKeepAlive();
      armBackgroundTimer();
      scheduleNativeFinish(endAt);
    }
  }else if(running){
    saveTimer();
    armBackgroundTimer();
    scheduleNativeFinish(endAt);
    startKeepAlive();
  }
});
addEventListener('pageshow',()=>{
  syncFromClock();
  if(pendingBeep)beep();
});
addEventListener('pagehide',()=>{if(running)saveTimer()});
addEventListener('freeze',()=>{if(running)saveTimer()},{capture:true});

addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  installPrompt=e;
  $('#installBtn').hidden=false;
});
bindTap($('#installBtn'),async()=>{
  if(installPrompt){
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;
    $('#installBtn').hidden=true;
  }
});

if('serviceWorker'in navigator){
  addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js');
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      restoreTimer();
      navigator.serviceWorker.addEventListener('controllerchange',()=>{});
    }catch(e){
      restoreTimer();
    }
  });
}else{
  restoreTimer();
}

loadNative();
state();
render();
