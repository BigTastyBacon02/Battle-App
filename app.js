// Necro Slayer – Mobile Web PWA (vollständige Version)
const W = window, D = document, C = D.getElementById('game'), ctx = C.getContext('2d',{alpha:false});
let DPR = Math.max(1, W.devicePixelRatio || 1);
function resize(){ const r = W.innerWidth/W.innerHeight; const target = r<9/16 ? {w:720*r,h:720}:{w:1280,h:720}; C.width=target.w*DPR; C.height=target.h*DPR; C.style.width=target.w+'px'; C.style.height=target.h+'px'; ctx.setTransform(DPR,0,0,DPR,0,0); } 
W.addEventListener('resize',resize,{passive:true}); resize();

// RNG
const R = {seed:Date.now()%1e9, next(){ this.seed = (this.seed*1664525+1013904223)|0; return (this.seed>>>0)/4294967296 }};

// WebAudio
let audioReady=false, ac, master, dist, gain;
function initAudio(){
  if(audioReady) return;
  ac = new (window.AudioContext||window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value=.6;
  dist = ac.createWaveShaper();
  dist.curve = new Float32Array(44100).map((_,i)=>{ const x=i/44100*2-1; const k=50; return (1+k)*x/(1+k*Math.abs(x)) });
  gain = ac.createGain(); gain.gain.value=.9;
  gain.connect(dist); dist.connect(master); master.connect(ac.destination);
  audioReady=true;
}
function metalChug(){ if(!audioReady) return; const o = ac.createOscillator(), g=ac.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(55, ac.currentTime); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.5, ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.25); o.connect(g); g.connect(gain); o.start(); o.stop(ac.currentTime+0.26); }
function boomKick(){ if(!audioReady) return; const o = ac.createOscillator(), g=ac.createGain(); o.type='sine'; o.frequency.setValueAtTime(120, ac.currentTime); o.frequency.exponentialRampToValueAtTime(40, ac.currentTime+.2); g.gain.setValueAtTime(.7, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime+.3); o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime+.3); }

// State
const state = { started:false, dead:false, px:320, py:360, vx:0, vy:0, dir:1, hp:100, score:0, wave:1, rage:0, fury:false, furyTimer:0, zombies:[], bullets:[], particles:[] };

// UI
const hpEl=D.getElementById('hp'), scoreEl=D.getElementById('score'), waveEl=D.getElementById('wave'), rageEl=D.getElementById('rage');
const overlay=D.getElementById('overlay');
D.getElementById('startBtn').addEventListener('click',()=>{ initAudio(); startGame(); });
D.getElementById('btnSlash').addEventListener('click',()=>attackSlash());
D.getElementById('btnShoot').addEventListener('click',()=>attackShoot());
D.getElementById('btnRage').addEventListener('click',()=>activateRage());

// Stick
const stick = {el:D.getElementById('stickL'), nub:D.querySelector('#stickL .nub'), x:0,y:0, dx:0,dy:0, active:false, r:60};
function stickEvt(e){ const t = (e.touches? e.touches[0] : e); const rect = stick.el.getBoundingClientRect(); const cx = rect.left+rect.width/2, cy = rect.top+rect.height/2; const dx = t.clientX-cx, dy = t.clientY-cy; const len = Math.min(stick.r, Math.hypot(dx,dy)); const ang = Math.atan2(dy,dx); stick.dx = Math.cos(ang)*len/stick.r; stick.dy = Math.sin(ang)*len/stick.r; stick.nub.style.transform=`translate(${stick.dx*40}px,${stick.dy*40}px)`; }
stick.el.addEventListener('touchstart',e=>{stick.active=true;stickEvt(e);},{passive:true});
stick.el.addEventListener('touchmove',stickEvt,{passive:true});
stick.el.addEventListener('touchend',()=>{stick.active=false;stick.dx=stick.dy=0;stick.nub.style.transform='translate(-50%,-50%)';});

function startGame(){ overlay.style.display='none'; state.started=true; state.dead=false; Object.assign(state,{px:320,py:360,vx:0,vy:0,hp:100,score:0,wave:1,rage:0,fury:false,furyTimer:0,zombies:[],bullets:[],particles:[]}); for(let i=0;i<8;i++) spawnZombie(); loop(); }

function spawnZombie(speedMul=1){ const x = R.next()<.5 ? -40 : C.width+40; const y = 80 + R.next()*(C.height-160); state.zombies.push({x,y,hp:20+state.wave*4, spd:(.4+.4*R.next())*speedMul}); }
function spawnParticles(x,y,clr){ for(let i=0;i<10;i++){ state.particles.push({x,y,vx:(R.next()-.5)*3,vy:(R.next()-.5)*3,life:30,clr}); } }

function attackSlash(){ if(!state.started||state.dead) return; metalChug(); const reach=60, arc=Math.PI*0.9; const hits = state.zombies.filter(z=>{ const dx=z.x-state.px, dy=z.y-state.py, d=Math.hypot(dx,dy); const a=Math.atan2(dy,dx); return d<reach && Math.abs(a - (state.dir>0?0:Math.PI))<arc/2; }); hits.forEach(z=>{ z.hp-=25*(state.fury?2:1); spawnParticles(z.x,z.y,'#f33'); state.score++; state.rage=Math.min(100,state.rage+6); boomKick(); }); }
function attackShoot(){ if(!state.started||state.dead) return; metalChug(); const dir=state.dir, spread=0.2; for(let i=0;i<5;i++){ state.bullets.push({x:state.px+dir*20,y:state.py-6,vx:(4+R.next()*2)*dir, vy:(R.next()-0.5)*spread, life:40}); } }
function activateRage(){ if(state.rage<100||state.fury) return; state.fury=true; state.furyTimer=600; state.rage=0; for(let i=0;i<40;i++) spawnParticles(state.px,state.py,'#f80'); }

let raf=0, last=0;
function loop(t=0){ if(!state.started) return; raf = requestAnimationFrame(loop); const dt = Math.min(33, t-last || 16)/16; last=t;
  const speed = state.fury? 4 : 2.6; state.vx = stick.dx*speed; state.vy = stick.dy*speed; state.px = Math.max(40, Math.min(C.width-40, state.px + state.vx)); state.py = Math.max(60, Math.min(C.height-60, state.py + state.vy)); if(Math.abs(state.vx)>0.02) state.dir = state.vx>0?1:-1;
  state.bullets.forEach(b=>{ b.x+=b.vx; b.y+=b.vy; b.life--; }); state.bullets = state.bullets.filter(b=>b.life>0);
  state.zombies.forEach(z=>{ const dx=state.px-z.x, dy=state.py-z.y; const d=Math.hypot(dx,dy)+0.001; z.x += (dx/d)*z.spd*(state.fury?.6:1); z.y += (dy/d)*z.spd*(state.fury?.6:1); state.bullets.forEach(b=>{ if(Math.hypot(b.x-z.x,b.y-z.y)<14){ z.hp-=18*(state.fury?1.6:1); b.life=0; spawnParticles(z.x,z.y,'#f55'); } }); if(d<24 && !state.dead){ state.hp-=0.15*(state.fury?0.3:1); if(Math.random()<.02) boomKick(); if(state.hp<=0){ state.hp=0; state.dead=true; gameOver(); } } });
  state.zombies = state.zombies.filter(z=>z.hp>0); while(state.zombies.length<6+state.wave) spawnZombie(1+state.wave*0.05);
  if(state.score>0 && state.score%25===0){ state.wave = 1+Math.floor(state.score/25); }
  if(state.fury){ state.furyTimer--; if(state.furyTimer<=0) state.fury=false; }
  state.particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.life--; }); state.particles = state.particles.filter(p=>p.life>0);
  hpEl.textContent = Math.round(state.hp); scoreEl.textContent = state.score; waveEl.textContent = state.wave; rageEl.textContent = (state.fury? 'MAX' : Math.round(state.rage)+'%');
  render();
}

function gameOver(){ setTimeout(()=>{ cancelAnimationFrame(raf); overlay.style.display='grid'; overlay.querySelector('h1').textContent='You Died'; overlay.querySelector('p').innerHTML = `Kills: <b>${state.score}</b> · Wave: <b>${state.wave}</b><br>Tippe für neuen Run.`; },300); }

function render(){ const g=ctx, w=C.width, h=C.height; g.fillStyle='#0a0a0a'; g.fillRect(0,0,w,h);
  const grd=g.createLinearGradient(0,0,0,h); grd.addColorStop(0,'#1a0000'); grd.addColorStop(.5,'#0b0505'); grd.addColorStop(1,'#070707'); g.fillStyle=grd; g.fillRect(0,0,w,h);
  g.fillStyle='#111'; for(let i=0;i<18;i++){ const x=(i*90+ (i%2?40:0))%w; g.fillRect(x,h-80-(i%3)*18,30,80+(i%3)*6); }
  g.fillStyle='#121212'; g.fillRect(w*0.72,h-160,120,160); g.fillRect(w*0.77,h-220,80,220); g.fillRect(w*0.82,h-260,60,260);
  state.particles.forEach(p=>{ g.globalAlpha=Math.max(0,p.life/30); g.fillStyle=p.clr; g.beginPath(); g.arc(p.x,p.y,2.5,0,6.28); g.fill(); g.globalAlpha=1; });
  drawHero(g, state.px, state.py, state.dir, state.fury);
  state.zombies.forEach(z=>drawZombie(g,z.x,z.y));
  g.fillStyle='#fbb'; state.bullets.forEach(b=>{ g.fillRect(b.x-2,b.y-2,4,4); });
  const v=g.createRadialGradient(w/2,h/2,Math.min(w,h)/2.2,w/2,h/2,Math.min(w,h)/1.2); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.55)'); g.fillStyle=v; g.fillRect(0,0,w,h);
  if(state.fury){ g.fillStyle='rgba(255,80,0,.08)'; g.fillRect(0,0,w,h);}
}

function drawHero(g,x,y,dir,fury){ g.save(); g.translate(x,y);
  g.fillStyle='#202020'; g.fillRect(-18,22,36,14);
  g.strokeStyle='#333'; g.lineWidth=3; g.beginPath(); g.moveTo(-8,6); g.lineTo(-8,22); g.moveTo(8,6); g.lineTo(8,22); g.stroke();
  g.fillStyle='#1a1a1a'; g.beginPath(); g.moveTo(-20,0); g.lineTo(20,0); g.lineTo(18,8); g.lineTo(-18,10); g.closePath(); g.fill();
  g.fillStyle='#101010'; g.fillRect(-12,-18,24,18);
  g.fillStyle='#d0b09a'; g.beginPath(); g.arc(0,-26,10,0,6.28); g.fill();
  g.fillStyle=fury?'#ff9a3d':'#caa86a'; g.beginPath(); g.ellipse(0,-28,14,10,0,0,6.28); g.fill();
  g.fillStyle=fury?'#fff':'#f55'; g.fillRect(-4,-28,3,2); g.fillRect(1,-28,3,2);
  g.save(); g.translate(dir>0?16:-16,-10); g.rotate(dir>0? -0.1: Math.PI+0.1); g.fillStyle='#9a9a9a'; g.fillRect(0,-3,36,6); g.fillStyle='#3a3a3a'; g.fillRect(-6,-4,12,8); g.restore();
  g.fillStyle='#382e2e'; g.fillRect(-6, -12, 12, 26);
  if(fury){ g.strokeStyle='rgba(255,120,0,.8)'; g.lineWidth=2; g.beginPath(); g.arc(0,-10,28,0,6.28); g.stroke(); }
  g.restore();
}

function drawZombie(g,x,y){ g.save(); g.translate(x,y); g.fillStyle='#0e190e'; g.beginPath(); g.arc(0,-10,12,0,6.28); g.fill(); g.fillStyle='#132013'; g.fillRect(-10,-10,20,28); g.fillStyle='#f44'; g.fillRect(-3,-13,3,3); g.fillRect(1,-13,3,3); g.restore(); }

C.addEventListener('touchstart',e=>{ initAudio(); const path = e.composedPath(); if(path.includes(document.getElementById('stickL')) || path.find(n=>n.tagName==='BUTTON')) return; attackSlash(); },{passive:true});