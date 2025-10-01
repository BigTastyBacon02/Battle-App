/* VS Tournament – Canvas Edition */
const WIKI=(q,size=420)=>`https://de.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=${size}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q)}`;
const OPENVERSE=(q,n=12)=>`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=true`;

const cnv=document.getElementById('game'), ctx=cnv.getContext('2d');
const panel=document.getElementById('panel');
const ui=document.getElementById('ui'), btnLeft=document.getElementById('btnLeft'), btnRight=document.getElementById('btnRight'), btnUndo=document.getElementById('btnUndo');

let DPR=1, W=0, H=0, t0=performance.now();
function resize(){DPR=Math.max(1, Math.min(3, devicePixelRatio||1)); W=innerWidth; H=innerHeight; cnv.width=W*DPR; cnv.height=H*DPR; cnv.style.width=W+'px'; cnv.style.height=H+'px'; ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize', resize); resize();
addEventListener('orientationchange', resize);

// --- tiny tween/particles ---
const ease=(x)=>1- Math.pow(1-x,3);
const parts=[];
function burst(x,y,clr){for(let i=0;i<28;i++)parts.push({x,y,vx:(Math.random()*2-1)*4,vy:(Math.random()*-4-2),g:0.18,a:1,c:clr||['#7cf2ff','#2da6ff','#ff6ad5','#64ffb0'][i%4]});}
function stepParticles(dt){for(const p of parts){p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.a-=0.02;} for(let i=parts.length-1;i>=0;i--) if(parts[i].a<=0) parts.splice(i,1);}
function drawParticles(){for(const p of parts){ctx.globalAlpha=Math.max(0,p.a); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,10); ctx.globalAlpha=1;}}

// --- audio: tiny synth loop ---
let audioCtx=null, musicOn=false;
function startMusic(){ if(musicOn) return; audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); const ctxA=audioCtx; const bpm=96, beat=60/bpm; const seq=[0,4,7,11,12,11,7,4]; const now=ctxA.currentTime+0.05; for(let bar=0; bar<16; bar++){ for(let i=0;i<seq.length;i++){ const t=now+(bar*seq.length+i)*beat*0.5; const o=ctxA.createOscillator(); const g=ctxA.createGain(); o.type='triangle'; o.frequency.value=196*Math.pow(2, seq[i]/12); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+beat*0.45); o.connect(g).connect(ctxA.destination); o.start(t); o.stop(t+beat*0.5);} } musicOn=true; }

// --- game state ---
const State={MENU:0, EDIT:1, MATCH:2, RESULT:3};
let state=State.MENU, names=["Mia Malkova","Johnny Sins","Abella Danger","Riley Reid","Angela White","Violet Myers","Eva Elfie","Kendra Lust"], target=1;
let pool=[], out=[], hist=[], cur=[], progress=0;

// UI builders
function clearPanel(){panel.innerHTML='';}
function btn(txt, on){const b=document.createElement('button'); b.className='btn'; b.textContent=txt; b.onclick=on; return b;}
function inputRow(){ const w=document.createElement('div'); w.className='inputwrap'; const i=document.createElement('input'); i.placeholder='Namen je Zeile oder Komma'; i.value=names.join(', '); i.onchange=()=>{ const v=i.value.trim(); names = v.includes('\n')? v.split(/\r?\n/): v.split(','); names = names.map(s=>s.trim()).filter(Boolean); }; const n=document.createElement('input'); n.placeholder='Ziel'; n.type='number'; n.value=target; n.style.width='70px'; n.onchange=()=> target=Math.max(1,parseInt(n.value||'1',10)); w.append(i,n); return w; }
function urlSetter(side){ const w=document.createElement('div'); w.className='inputwrap'; const i=document.createElement('input'); i.placeholder='Bild-URL für '+(side==='L'?(cur[0]||'links'):(cur[1]||'rechts')); const b=document.createElement('button'); b.className='btn secondary'; b.textContent='Setzen'; b.onclick=()=>{ const v=i.value.trim(); if(/^https?:\/\//i.test(v)){ (side==='L'?L:R).img.src=v; i.value=''; draw(0); } else alert('http(s)-URL einfügen'); }; w.append(i,b); return w; }

// Image fetching
async function wikiThumb(q){ try{ const r=await fetch(WIKI(q)); const j=await r.json(); if(j&&j.query&&j.query.pages){ const v=Object.values(j.query.pages)[0]; if(v&&v.thumbnail) return v.thumbnail.source; } }catch(e){} return null; }
async function openverseList(q,n=12){ try{ const r=await fetch(OPENVERSE(q,n)); const j=await r.json(); return (j.results||[]).map(it=>it.thumbnail||it.url); }catch(e){ return []; } }

function loadPortrait(name){ const img=new Image(); img.src='assets/placeholder.png'; (async()=>{ const w=await wikiThumb(name); if(w) img.src=w; const ov=await openverseList(name,18); if(ov[0]) img.src=ov[0]; })(); return img; }

// actors
const L={x:0,y:0,scale:0.9,img:new Image(),name:'',alpha:1}, R={x:0,y:0,scale:0.9,img:new Image(),name:'',alpha:1};

function startMatch(){
  if(pool.length<2) return;
  const a=Math.floor(Math.random()*pool.length); let b=Math.floor(Math.random()*pool.length); while(b===a) b=Math.floor(Math.random()*pool.length);
  cur=[pool[a], pool[b]]; L.name=cur[0]; R.name=cur[1]; L.img=loadPortrait(L.name); R.img=loadPortrait(R.name);
}

function layout(){
  L.x=W*0.27; L.y=H*0.52; R.x=W*0.73; R.y=H*0.52;
}

function choose(side){ // 0 left, 1 right
  const w=cur[side], l=cur[1-side];
  pool = pool.filter(n=>n!==w && n!==l); pool.push(w); out.push(l); hist.push({w,l});
  burst(side?R.x:L.x, side?R.y:L.y);
  progress = 1 - (pool.length - target) / (names.length - target);
  if(pool.length<=target){ state=State.RESULT; clearPanel(); panel.append(btn('Nochmal', ()=>{state=State.MENU; draw(0); })); }
  else { startMatch(); }
}

function undo(){
  const h=hist.pop(); if(!h) return;
  pool = pool.filter(n=>n!==h.w); const j=out.lastIndexOf(h.l); if(j>-1) out.splice(j,1);
  pool.push(h.w,h.l); startMatch();
}

// input
btnLeft.onclick=()=> state===State.MATCH && choose(0);
btnRight.onclick=()=> state===State.MATCH && choose(1);
btnUndo.onclick=()=> state===State.MATCH && undo();
let sx=0, sy=0;
cnv.addEventListener('touchstart',e=>{const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }, {passive:true});
cnv.addEventListener('touchend',e=>{const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.abs(dx)>50 && Math.abs(dy)<60){ if(dx>0) choose(1); else choose(0);} });

// main loop
function draw(dt){
  // bg
  ctx.clearRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0a0d1c'); g.addColorStop(1,'#0d1530'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // glow orbs
  ctx.globalAlpha=.35; ctx.fillStyle='#182c75'; ctx.beginPath(); ctx.arc(W*0.2, -80, 300, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#2b1360'; ctx.beginPath(); ctx.arc(W*0.9, -160, 360, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha=1;

  if(state===State.MENU){
    ctx.textAlign='center'; ctx.fillStyle='#cfe6ff'; ctx.font='700 28px system-ui'; ctx.fillText('VS Tournament', W/2, H*0.22);
    ctx.fillStyle='#8fb3ff'; ctx.font='16px system-ui'; ctx.fillText('Neues Turnier starten', W/2, H*0.29);
    clearPanel(); panel.append(btn('Namen bearbeiten', ()=>{ state=State.EDIT; draw(0);}),
                               btn('Start (Demo-Namen)', ()=>{ names=["Mia Malkova","Johnny Sins","Abella Danger","Riley Reid","Angela White","Violet Myers","Eva Elfie","Kendra Lust"]; target=1; pool=[...new Set(names)]; out=[]; hist=[]; startMatch(); state=State.MATCH; clearPanel(); panel.append(urlSetter('L'), urlSetter('R')); startMusic(); draw(0);}));
  }
  else if(state===State.EDIT){
    ctx.textAlign='center'; ctx.fillStyle='#cfe6ff'; ctx.font='700 24px system-ui'; ctx.fillText('Namen eingeben', W/2, H*0.18);
    clearPanel(); const row=inputRow(); panel.append(row,
      btn('Start', ()=>{ pool=[...new Set(names)]; out=[]; hist=[]; if(pool.length<2||target>=pool.length){ alert('Mind. 2 Namen & Ziel kleiner als Anzahl.'); return; } startMatch(); state=State.MATCH; clearPanel(); panel.append(urlSetter('L'), urlSetter('R')); startMusic(); draw(0);}),
      btn('Zurück', ()=>{ state=State.MENU; draw(0);}));
  }
  else if(state===State.MATCH){
    layout();
    // portraits
    drawCard(L); drawCard(R);
    // names
    ctx.textAlign='center'; ctx.fillStyle='#dbe8ff'; ctx.font='900 18px system-ui'; ctx.fillText(L.name, L.x, L.y+160);
    ctx.fillText(R.name, R.x, R.y+160);
    // progress
    ctx.fillStyle='#8fb3ff'; ctx.font='12px system-ui'; ctx.fillText(`${pool.length} aktiv • Ziel ${target}`, W/2, 26);
  }
  else if(state===State.RESULT){
    ctx.textAlign='center'; ctx.fillStyle='#cfe6ff'; ctx.font='700 26px system-ui'; ctx.fillText('Gewinner', W/2, H*0.24);
    // list remaining
    ctx.font='16px system-ui'; ctx.fillStyle='#8fb3ff';
    for(let i=0;i<pool.length;i++){ ctx.fillText(pool[i], W/2, H*0.32 + i*22); }
  }

  drawParticles();
  requestAnimationFrame(draw);
}
function drawCard(obj){
  // frame
  ctx.save(); ctx.translate(obj.x, obj.y); ctx.globalAlpha=obj.alpha;
  // border glow
  ctx.fillStyle='rgba(124,242,255,0.08)'; ctx.beginPath(); ctx.arc(0,0,148,0,Math.PI*2); ctx.fill();
  // image
  const w=220,h=220;
  try{ ctx.drawImage(obj.img, -w/2, -h/2, w, h); }catch(e){}
  // ring
  ctx.strokeStyle='rgba(124,242,255,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0, w/2+10, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

requestAnimationFrame(draw);
