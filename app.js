const $=s=>document.querySelector(s);
const minutes=$('#minutes'), seconds=$('#seconds'), ring=$('#ring'), setLabel=$('#setLabel');
const startBtn=$('#start'), startText=$('#startText'), startIcon=$('#startIcon');
const done=$('#done'), app=document.querySelector('.app');

const R=132, C=2*Math.PI*R;
ring.style.strokeDasharray=C;
let selected=60, remaining=60, running=false, last=0, raf=0, audioCtx=null, endTimer=null;

function render(){
  const m=Math.floor(remaining/60), s=Math.floor(remaining%60);
  minutes.textContent=String(m).padStart(2,'0');
  seconds.textContent=String(s).padStart(2,'0');
  setLabel.textContent=`${selected} SEC`;
  const ratio=selected?Math.max(0,Math.min(1,remaining/selected)):0;
  ring.style.strokeDashoffset=C*(1-ratio);
  document.querySelectorAll('.presets button').forEach(b=>b.classList.toggle('active',+b.dataset.time===selected));
}
function setPlayIcon(){
  // O botão Iniciar permanece sempre como Iniciar.
  // Durante a contagem ele fica desabilitado; o botão Pausar é separado.
  startIcon.innerHTML='<path d="m9 5 10 7-10 7V5Z"/>';
  startText.textContent='Iniciar';
  startBtn.disabled=running;
  startBtn.setAttribute('aria-disabled', running ? 'true' : 'false');
}
function stopRAF(){cancelAnimationFrame(raf);raf=0}
function tick(t){
  if(!running)return;
  if(!last)last=t;
  const elapsed=(t-last)/1000; last=t;
  remaining=Math.max(0,remaining-elapsed);
  render();
  if(remaining<=0){finish();return}
  raf=requestAnimationFrame(tick);
}
function start(){
  if(remaining<=0) remaining=selected;
  running=true; last=0; done.classList.remove('show'); app.classList.remove('finished');
  setPlayIcon(); unlockAudio(); raf=requestAnimationFrame(tick);
}
function pause(){running=false;stopRAF();setPlayIcon()}
function reset(){running=false;stopRAF();remaining=selected;done.classList.remove('show');app.classList.remove('finished');setPlayIcon();render()}
function choose(v){selected=v;remaining=v;running=false;stopRAF();done.classList.remove('show');app.classList.remove('finished');setPlayIcon();render()}
function adjust(delta){selected=Math.max(5,Math.min(3600,selected+delta));remaining=selected;running=false;stopRAF();done.classList.remove('show');app.classList.remove('finished');setPlayIcon();render()}

function unlockAudio(){
  try{
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if(audioCtx.state === 'suspended'){
      audioCtx.resume();
    }

    // Pequeno sinal silencioso para desbloquear o áudio no iOS
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    gain.gain.setValueAtTime(0.00001, audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);

  }catch(e){
    console.warn('Áudio não pôde ser desbloqueado:', e);
  }
}
function beep(){
  try{
    unlockAudio();

    if(!audioCtx) return;

    const playAlert = () => {
      const now = audioCtx.currentTime;

      const pulses = [
        { start: 0.00, duration: 0.38, freq: 880 },
        { start: 0.45, duration: 0.38, freq: 1046 },
        { start: 0.90, duration: 0.75, freq: 1318 }
      ];

      pulses.forEach(p => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(p.freq, now + p.start);

        gain.gain.setValueAtTime(0.0001, now + p.start);
        gain.gain.linearRampToValueAtTime(
          0.85,
          now + p.start + 0.015
        );

        gain.gain.setValueAtTime(
          0.85,
          now + p.start + p.duration - 0.05
        );

        gain.gain.linearRampToValueAtTime(
          0.0001,
          now + p.start + p.duration
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + p.start);
        osc.stop(now + p.start + p.duration + 0.03);
      });
    };

    if(audioCtx.state === 'suspended'){
      audioCtx.resume().then(playAlert);
    }else{
      playAlert();
    }

    if(navigator.vibrate){
      navigator.vibrate([
        400,
        100,
        400,
        100,
        700
      ]);
    }

  }catch(e){
    console.warn('Erro ao tocar alerta:', e);
  }
}
function finish(){
  running=false;stopRAF();remaining=0;render();setPlayIcon();
  app.classList.add('finished');done.classList.add('show');beep();
  clearTimeout(endTimer);endTimer=setTimeout(()=>app.classList.remove('finished'),2600);
}

$('#start').addEventListener('click',()=>running?pause():start());
$('#pause').addEventListener('click',pause);
$('#reset').addEventListener('click',reset);
$('#minus').addEventListener('click',()=>adjust(-5));
$('#plus').addEventListener('click',()=>adjust(5));
document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>choose(+b.dataset.time)));

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#installBtn').classList.add('hidden');
});
window.addEventListener('appinstalled',()=>$('#installBtn').classList.add('hidden'));

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
render();
