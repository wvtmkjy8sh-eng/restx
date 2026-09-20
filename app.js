import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const $=s=>document.querySelector(s),
minutes=$('#minutes'),seconds=$('#seconds'),ring=$('#ring'),
statusEl=$('#status'),done=$('#done'),app=document.querySelector('.app'),
startBtn=$('#start'),startText=$('#startText'),startIcon=$('#startIcon'),
alertAudio=$('#restxAlertAudio');

const R=132,C=2*Math.PI*R;
ring.style.strokeDasharray=C;

let selected=60,remaining=60,running=false,last=0,raf=0,audioCtx=null,installPrompt=null;
let endAt=0, backgroundFinishTimer=0;

const TIMER_KEY='restx_timer_state_v2';
const SW_CHANNEL='RESTX_TIMER';

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
  startIcon.innerHTML='<path d="m9 5 10 7-10 7V5Z"/>';
}
function unlockAudio(){
  try{
    if('audioSession' in navigator){
      try{navigator.audioSession.type='playback'}catch(e){}
    }
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    if(alertAudio){
      alertAudio.volume=.001;
      let p=alertAudio.play();
      if(p&&p.then)p.then(()=>{
        alertAudio.pause();
        alertAudio.currentTime=0;
      }).catch(()=>{});
    }
  }catch(e){}
}
function fallback(){
  try{
    unlockAudio();
    if(!audioCtx)return;
    let n=audioCtx.currentTime;
    [{s:0,d:.42,f:880},{s:.48,d:.42,f:1046},{s:.96,d:.82,f:1318}].forEach(p=>{
      let o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='square';
      o.frequency.setValueAtTime(p.f,n+p.s);
      g.gain.setValueAtTime(.0001,n+p.s);
      g.gain.linearRampToValueAtTime(.85,n+p.s+.015);
      g.gain.setValueAtTime(.85,n+p.s+p.d-.055);
      g.gain.linearRampToValueAtTime(.0001,n+p.s+p.d);
      o.connect(g);g.connect(audioCtx.destination);
      o.start(n+p.s);o.stop(n+p.s+p.d+.02);
    });
  }catch(e){}
}
function beep(){
  try{
    if(alertAudio){
      alertAudio.pause();
      alertAudio.currentTime=0;
      alertAudio.volume=1;
      let p=alertAudio.play();
      if(p&&p.catch)p.catch(fallback);
    }else fallback();
    if(navigator.vibrate)navigator.vibrate([400,100,400,100,700]);
  }catch(e){fallback()}
}


const NATIVE_NOTIFICATION_ID=9001001;
const NATIVE_CHANNEL_ID='restx-rest';
let nativeNotificationsReady=false;

function isNativeApp(){
  try{return Capacitor.isNativePlatform()}catch(e){return false}
}

async function setupNativeNotifications(){
  if(!isNativeApp())return false;
  try{
    let perm=await LocalNotifications.checkPermissions();
    if(perm.display!=='granted'){
      perm=await LocalNotifications.requestPermissions();
    }
    if(perm.display!=='granted')return false;
    if(Capacitor.getPlatform()==='android'){
      try{
        await LocalNotifications.createChannel({
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
  if(!isNativeApp())return false;
  try{
    if(!nativeNotificationsReady && !(await setupNativeNotifications()))return false;
    await LocalNotifications.cancel({notifications:[{id:NATIVE_NOTIFICATION_ID}]});
  }catch(e){}
  try{
    const at=new Date(endTimestamp);
    if(at.getTime()<=Date.now())return false;
    await LocalNotifications.schedule({
      notifications:[{
        id:NATIVE_NOTIFICATION_ID,
        title:'RestX — descanso finalizado',
        body:'Seu descanso terminou. Próximo exercício.',
        schedule:{
          at,
          allowWhileIdle:true
        },
        sound:'restx_alert.wav',
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
  if(!isNativeApp())return;
  try{
    await LocalNotifications.cancel({notifications:[{id:NATIVE_NOTIFICATION_ID}]});
  }catch(e){}
}

async function enableNotifications(){
  if(isNativeApp()) return setupNativeNotifications();
  if(!('Notification' in window))return false;
  if(Notification.permission==='granted')return true;
  if(Notification.permission==='denied')return false;
  try{return await Notification.requestPermission()==='granted'}catch(e){return false}
}
function notifyFinish(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const title='RestX — descanso finalizado';
  const options={
    body:'Seu descanso terminou. Próximo exercício.',
    tag:'restx-rest-finished',
    renotify:true,
    requireInteraction:false,
    icon:'/icons/icon-192.svg',
    badge:'/icons/icon-192.svg',
    vibrate:[400,100,400,100,700],
    data:{url:'/'}
  };
  try{
    if(navigator.serviceWorker?.controller){
      navigator.serviceWorker.controller.postMessage({
        type:'SHOW_FINISH_NOTIFICATION',
        title,
        options
      });
      return;
    }
  }catch(e){}
  try{new Notification(title,options)}catch(e){}
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
      url:'/'
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
async function start(){
  if(running)return;
  if(remaining<=0)remaining=selected;
  unlockAudio();
  await enableNotifications();
  running=true;
  endAt=Date.now()+Math.max(0,remaining*1000);
  last=performance.now();
  done.classList.remove('show');
  app.classList.remove('finished');
  state();render();saveTimer();armBackgroundTimer();
  if(isNativeApp()) await scheduleNativeFinish(endAt);
  raf=requestAnimationFrame(tick);
}
function reset(){
  running=false;
  endAt=0;
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
  beep();
  notifyFinish();
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
    if(isNativeApp()) await scheduleNativeFinish(endAt);
    raf=requestAnimationFrame(tick);
  }catch(e){
    localStorage.removeItem(TIMER_KEY);
  }
}

$('#start').onclick=start;
$('#reset').onclick=reset;
$('#minus').onclick=()=>adjust(-5);
$('#plus').onclick=()=>adjust(5);
document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>choose(+b.dataset.time));

addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    syncFromClock();
    if(running)armBackgroundTimer();
  }else if(running){
    saveTimer();
    armBackgroundTimer();
  }
});
addEventListener('pageshow',()=>syncFromClock());
addEventListener('pagehide',()=>{if(running)saveTimer()});

addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  installPrompt=e;
  $('#installBtn').hidden=false;
});
$('#installBtn').onclick=async()=>{
  if(installPrompt){
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;
    $('#installBtn').hidden=true;
  }
};

if('serviceWorker'in navigator){
  addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js');
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      if(navigator.serviceWorker.controller)restoreTimer();
      navigator.serviceWorker.addEventListener('controllerchange',()=>{});
    }catch(e){}
  });
}else{
  restoreTimer();
}

state();
render();
